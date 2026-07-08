// /api/copy：一鍵上架文案。佬筍製圖的文案系統搬過來，但升級成後台直接呼叫 Claude 生成，
// 員工拿到的是「可直接貼上蝦皮的成品」，不再需要複製 prompt 去 GPT。
// 純文字呼叫（不傳圖），一次約 NT$0.3~0.5，與 /api/analyze 共用額度記帳與月上限。
import { callClaudeApi, addUsage, buildBudget, parseAnalysisText } from './analyze.js'

const COPY_MAX_TOKENS = 2000
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' }

// 蝦皮標題字數上限（D2 拍板；日後蝦皮放寬只改這一個常數）。主關鍵字須落在前 MAIN_KW_FRONT 字內。
export const TITLE_MAX = 60
export const MAIN_KW_FRONT = 10

// 禁字黑名單（措辭優化階段再跟 Mason 一起調）
export const FORBIDDEN_WORDS = [
  '最便宜',
  '全網最低',
  '第一名',
  '冠軍',
  '保證',
  '治療',
  '療效',
  '醫療級',
  '國家認證',
  '100%有效',
]

const COPY_SYSTEM_PROMPT = `你是「恩希貿易」的蝦皮上架文案引擎。依據使用者提供的真實商品資料，輸出一份可直接貼上蝦皮的文案 JSON。只輸出合法 JSON：不要 markdown 圍欄、不要任何解說文字。

【硬規則】
- 只能使用提供的真實資料；規格、材質、功能、認證不得編造或誇大（使用者沒說 316 就不准寫 316）。
- 全部繁體中文，蝦皮口語風。
- 禁字（一個都不准出現）：${FORBIDDEN_WORDS.join('、')}。
- 流量詞（現貨、24H出貨、隔日到貨、免運、熱銷…）：只有使用者的主關鍵字裡本來就有才能用，嚴禁自行添加。
- 不放品牌名、賣場名、活動網址。

【輸出欄位】
1. shopee_title：蝦皮標題，嚴格 ≤60 字元（中文 1 字＝1 字元，含空格）。主關鍵字放最前面，之後堆高搜尋量的品類關鍵字。
2. golden_intro：黃金前段，100~150 字，前 30 字自然帶入主關鍵字，結尾一句行動呼籲。
3. pain_points：2~3 段「痛點→解方」短文（字串陣列），每段以一個 emoji 開頭，像跟好朋友聊天、絕對不能是客服語。
   ❌ 錯誤示範：「採用人體工學設計的加長柄鋼絲刷，讓您輕鬆清潔」
   ✅ 正確示範：「洗鍋子根本是惡夢，手每次都油油的><，這支加長柄一握就到底，手完全不用碰到油」
4. spec_lines：條列規格（字串陣列，只列使用者有提供的：材質／容量／尺寸／顏色等，不可自行增減數字）。
5. aftersale：售後三段公板（字串陣列，長度固定 3，格式【標題｜品名暱稱】開頭）：
   - 【包裹的小保險｜○○】台灣現貨、出貨前人工檢查、物流受損會負責處理。
   - 【拆禮物的小儀式｜○○】請開箱錄影，數量／顏色／款式問題可加速處理。
   - 【關於完美主義｜○○】依這個商品「實際工藝」描述可能的微小公差與螢幕色差提醒（不要套用不相干的材質描述）。
6. hashtags：6~10 個，# 開頭，涵蓋品類、材質、使用情境。

【輸出 JSON 結構】
{ "shopee_title": "…", "golden_intro": "…", "pain_points": ["😩 …", "🙌 …"], "spec_lines": ["材質：…"], "aftersale": ["【包裹的小保險｜…】…", "【拆禮物的小儀式｜…】…", "【關於完美主義｜…】…"], "hashtags": ["#…"] }`

// 優化舊品·卡1：只優化「標題」，吃 keywords{main,aux} 產 2–3 個候選。
const OPTIMIZE_TITLE_SYSTEM_PROMPT = `你是蝦皮標題優化引擎。根據商品資料、指定的「主關鍵字」與「輔助關鍵字」，產出 2–3 個優化後的蝦皮標題候選。

【硬規則】
- 每個標題 ≤ ${TITLE_MAX} 字元（中文 1 字＝1 字元，含空格）。
- 主關鍵字必須放在標題「最前面」（前 ${MAIN_KW_FRONT} 字內）。
- 每個輔助關鍵字都要完整出現在標題中。
- 其餘用高搜尋量的品類／屬性詞把標題填到接近上限，但要通順、像真人下的標題，不是關鍵字亂堆。
- 禁字（一個都不准出現）：${FORBIDDEN_WORDS.join('、')}。
- 不放品牌名、賣場名、活動網址；不編造規格、材質、認證。

只輸出合法 JSON（不要 markdown 圍欄、不要解說）：{ "titles": ["候選1", "候選2", "候選3"] }`

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS })
}

function isStr(v) {
  return typeof v === 'string' && v.length > 0
}

// 中文 1 字＝1 字元的字數（用 code point 數，避免 emoji 算兩個）
export function titleLen(s) {
  return [...String(s || '')].length
}

// kw 是否在 title 的前 n 個字內「開始出現」（用 code point，CJK 才不會被 emoji 算歪）。
function startsWithin(title, kw, n) {
  const arr = [...String(title)]
  const lim = Math.min(n, arr.length)
  for (let i = 0; i < lim; i++) {
    if (arr.slice(i).join('').startsWith(kw)) return true
  }
  return false
}

// 優化標題的程式品檢（前端即時顯示、後端重修判斷共用）。
export function buildTitleChecks(title, keywords = {}) {
  const t = String(title || '')
  const main = String(keywords.main || '').trim()
  const aux = (Array.isArray(keywords.aux) ? keywords.aux : []).map((s) => String(s || '').trim()).filter(Boolean)
  return {
    len: titleLen(t),
    over: titleLen(t) > TITLE_MAX,
    mainFirst: main ? startsWithin(t, main, MAIN_KW_FRONT) : null,
    auxMissing: aux.filter((k) => !t.includes(k)),
    forbiddenHits: FORBIDDEN_WORDS.filter((w) => t.includes(w)),
  }
}

// 標題候選是否過關（全不過關就觸發後端重修一次）。
function titleOk(c) {
  return !c.over && c.mainFirst !== false && c.auxMissing.length === 0 && c.forbiddenHits.length === 0
}

export function validateCopy(c) {
  if (!c || typeof c !== 'object') return false
  if (!isStr(c.shopee_title) || !isStr(c.golden_intro)) return false
  if (!Array.isArray(c.pain_points) || c.pain_points.length < 1 || c.pain_points.length > 4) return false
  if (!c.pain_points.every(isStr)) return false
  if (!Array.isArray(c.spec_lines) || !c.spec_lines.every(isStr)) return false
  if (!Array.isArray(c.aftersale) || c.aftersale.length !== 3 || !c.aftersale.every(isStr)) return false
  if (!Array.isArray(c.hashtags) || c.hashtags.length < 3 || !c.hashtags.every(isStr)) return false
  return true
}

// 品檢不靠 AI 自覺：生成後用程式再掃一次。
export function buildChecks(copy, mainKeyword = '') {
  const title = copy.shopee_title || ''
  const everything = JSON.stringify(copy)
  const kw = String(mainKeyword || '').trim()
  return {
    titleLen: titleLen(title),
    titleOver: titleLen(title) > 60,
    forbiddenHits: FORBIDDEN_WORDS.filter((w) => everything.includes(w)),
    aftersaleOk:
      Array.isArray(copy.aftersale) &&
      copy.aftersale.length === 3 &&
      copy.aftersale.every((s) => /^【.+｜.+】/.test(s)),
    keywordFirst: kw ? title.slice(0, kw.length + 6).includes(kw) : null,
  }
}

function buildUserText(body) {
  const p = body.product || {}
  const colors = Array.isArray(p.colors) && p.colors.length > 0 ? p.colors.join('、') : '（未填）'
  const lines = [
    '【商品基本資料】',
    `品名：${p.name || '（未填）'}`,
    `材質：${p.material || '（未填）'}`,
    `顏色：${colors}`,
    `容量/尺寸：${p.size || '（未填）'}`,
    '',
    `【主關鍵字】${(body.mainKeyword || '').trim() || '（未指定：請自行從品名挑一個最有搜尋量的詞當主關鍵字）'}`,
  ]
  const h = body.hints || null
  if (h) {
    lines.push('', '【賣點素材（來自商品圖 AI 分析，可參考）】')
    if (h.category) lines.push(`品類：${h.category}`)
    if (Array.isArray(h.selling_points))
      lines.push(...h.selling_points.map((sp) => `賣點：${sp.title}——${sp.desc}`))
    if (h.target_audience) lines.push(`目標客群：${h.target_audience}`)
    if (Array.isArray(h.scenes)) lines.push(`使用場景：${h.scenes.join('、')}`)
  }
  const comp = (body.competitorTitles || '').trim()
  if (comp) {
    lines.push(
      '',
      '【競品標題參考】只能萃取「通用品類關鍵字」，嚴禁抄入競品的品牌名、賣場名、型號：',
      comp,
    )
  }
  return lines.join('\n')
}

export async function handleCopy(request, env) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: '後台尚未設定 AI 金鑰' }, 503)

  const budgetBefore = await buildBudget(env)
  if (budgetBefore.tracked && budgetBefore.usedTWD >= budgetBefore.limitTWD) {
    return json(
      {
        error: `本月 AI 額度已用完（NT$${budgetBefore.usedTWD} / NT$${budgetBefore.limitTWD}），下月 1 號自動重置`,
        budget: budgetBefore,
      },
      429,
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'body 必須是 JSON' }, 400)
  }

  // 優化舊品·卡1：只優化標題（向下相容——不帶 mode 就走原本的完整文案模式）。
  if (body.mode === 'optimize-title') return handleOptimizeTitle(env, body)

  if (!body.product || !isStr(body.product.name)) return json({ error: '缺少品名' }, 400)

  const firstMessages = [{ role: 'user', content: buildUserText(body) }]
  let spentInput = 0
  let spentOutput = 0

  async function call(messages) {
    const r = await callClaudeApi(env, {
      system: COPY_SYSTEM_PROMPT,
      messages,
      maxTokens: COPY_MAX_TOKENS,
    })
    spentInput += r.inputTokens
    spentOutput += r.outputTokens
    return r.text
  }

  let raw
  try {
    raw = await call(firstMessages)
  } catch (err) {
    await addUsage(env, spentInput, spentOutput)
    return json({ error: 'AI 產文案失敗：' + String(err && err.message ? err.message : err) }, 502)
  }

  let copy = null
  try {
    const parsed = parseAnalysisText(raw)
    if (validateCopy(parsed)) copy = parsed
  } catch {
    // 走重試
  }

  // 重試一次：格式錯 → 要求純 JSON；格式對但標題超過 60 字 → 只修標題。
  const over = copy && titleLen(copy.shopee_title) > 60
  if (!copy || over) {
    const correction = !copy
      ? '你上次輸出不是合法 JSON 或缺少必填欄位。請重新輸出完整合法的 JSON，不要 markdown 圍欄、不要任何解說文字。'
      : `shopee_title 目前 ${titleLen(copy.shopee_title)} 字元，超過 60 字元上限。請重新輸出完整 JSON：標題精簡到 60 字元以內（主關鍵字仍放最前面），其餘欄位保持原樣。`
    try {
      const retryRaw = await call([
        ...firstMessages,
        { role: 'assistant', content: raw || '（空白輸出）' },
        { role: 'user', content: correction },
      ])
      const parsed = parseAnalysisText(retryRaw)
      if (validateCopy(parsed)) copy = parsed // 重試成功就用新的；失敗就沿用舊的（若有）
    } catch {
      // 沿用第一次結果（若有）
    }
  }

  await addUsage(env, spentInput, spentOutput)

  if (!copy) return json({ error: 'AI 忙線中，再按一次', budget: await buildBudget(env) }, 502)
  return json({
    copy,
    checks: buildChecks(copy, body.mainKeyword),
    budget: await buildBudget(env),
  })
}

function buildTitleUserText(body, main, aux) {
  const p = body.product || {}
  const lines = [
    '【商品基本資料】',
    `品名：${p.name || '（未填）'}`,
    `材質：${p.material || '（未填）'}`,
  ]
  if (isStr(body.currentTitle)) lines.push(`現有標題（可參考、可改進）：${body.currentTitle}`)
  lines.push('', `【主關鍵字（放最前面）】${main}`, `【輔助關鍵字（每個都要出現）】${aux.join('、') || '（無）'}`)
  return lines.join('\n')
}

function parseTitles(raw) {
  const p = parseAnalysisText(raw)
  return p && Array.isArray(p.titles) ? p.titles.filter(isStr).slice(0, 3) : []
}

// 優化舊品·卡1：產優化標題。keywords.main 必填；回 { titles, titleChecks }，全不過關重修一次。
async function handleOptimizeTitle(env, body) {
  const kw = body.keywords || {}
  const main = String(kw.main || '').trim()
  const aux = (Array.isArray(kw.aux) ? kw.aux : []).map((s) => String(s || '').trim()).filter(Boolean).slice(0, 3)
  if (!main) return json({ error: '缺少主關鍵字' }, 400)

  const userText = buildTitleUserText(body, main, aux)
  let spentInput = 0
  let spentOutput = 0
  async function call(messages) {
    const r = await callClaudeApi(env, { system: OPTIMIZE_TITLE_SYSTEM_PROMPT, messages, maxTokens: COPY_MAX_TOKENS })
    spentInput += r.inputTokens
    spentOutput += r.outputTokens
    return r.text
  }

  let titles
  try {
    titles = parseTitles(await call([{ role: 'user', content: userText }]))
  } catch (err) {
    await addUsage(env, spentInput, spentOutput)
    return json({ error: 'AI 產標題失敗：' + String(err && err.message ? err.message : err) }, 502)
  }

  // 全部候選都不過關 → 帶著上次結果要求重修一次。
  const allBad = titles.length === 0 || titles.every((t) => !titleOk(buildTitleChecks(t, { main, aux })))
  if (allBad) {
    try {
      const retry = parseTitles(
        await call([
          { role: 'user', content: userText },
          { role: 'assistant', content: JSON.stringify({ titles }) },
          {
            role: 'user',
            content: `上一版標題不合格。請重出 2–3 個：每個 ≤${TITLE_MAX} 字元、主關鍵字「${main}」放最前面（前 ${MAIN_KW_FRONT} 字內）、每個輔助關鍵字（${aux.join('、') || '無'}）都要出現、無禁字。只輸出 {"titles":[...]}。`,
          },
        ]),
      )
      if (retry.length) titles = retry
    } catch {
      // 沿用第一次結果
    }
  }

  await addUsage(env, spentInput, spentOutput)
  if (titles.length === 0) return json({ error: 'AI 忙線中，再按一次', budget: await buildBudget(env) }, 502)
  return json({
    titles,
    titleChecks: titles.map((t) => buildTitleChecks(t, { main, aux })),
    budget: await buildBudget(env),
  })
}
