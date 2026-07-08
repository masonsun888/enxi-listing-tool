// /api/copy：一鍵上架文案。佬筍製圖的文案系統搬過來，但升級成後台直接呼叫 Claude 生成，
// 員工拿到的是「可直接貼上蝦皮的成品」，不再需要複製 prompt 去 GPT。
// 純文字呼叫（不傳圖），一次約 NT$0.3~0.5，與 /api/analyze 共用額度記帳與月上限。
import { callClaudeApi, addUsage, buildBudget, parseAnalysisText } from './analyze.js'
import {
  normalizeTitles,
  blacklistHits,
  coverageDedup,
  countIndependent,
  isFromTitles,
  classifyExclusion,
} from './keywords.js'

const COPY_MAX_TOKENS = 2000
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' }

// 蝦皮標題字數（D2 拍板；日後蝦皮放寬只改這裡）。優化標題塞 55–60 字、主關鍵字須落在前 MAIN_KW_FRONT 字內。
export const TITLE_MAX = 60
export const TITLE_MIN = 55
export const MAIN_KW_FRONT = 10
const MUST_INCLUDE_MAX = 4
const REPAIR_LIMIT = 2 // 品檢不過的重修上限
export const CANDIDATE_COUNT = 3 // 產給員工的候選數（不加到 5：品質靠「全合格」不靠數量）

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

// 優化舊品·卡1：單次呼叫完成「萃取→分類→選字→組標題」，回 titles + rationale（選字依據）。
const OPTIMIZE_TITLE_SYSTEM_PROMPT = `你是蝦皮標題優化引擎。使用者會給商品品名、（選填）現有標題、多條競品標題、（選填）必埋詞。你要「一次」完成：從競品標題萃取關鍵字 → 分類 → 選字 → 組出 3 個「塞好塞滿」的優化標題。

【萃取與分類】把競品標題出現過的詞分四類：品類詞、屬性詞、場景詞、服務詞。

【選字規則】
1. 主關鍵字＝競品標題中「獨立出現次數最高的品類詞」，放每個標題最前面（前 ${MAIN_KW_FRONT} 字內）。
2. 長複合詞優先＋涵蓋去重：若「陶瓷保溫瓶」入選，就不要再單獨放它的子字串「保溫瓶」佔字數。
3. 屬性詞／場景詞／賣點詞都要盡量吃進來補搜尋面（例：製冰盒的「脫模神器」「省空間」是核心賣點詞，一定要留）。
4. 服務詞（現貨／免運／隔日到貨／SGS／贈品…）只能用使用者「必埋詞」給的；你不得自行添加任何承諾類服務詞。必埋詞每一個都必須「一字不差」出現在每一個候選標題中。

【排除規則（只排這三類，其餘存疑一律保留進字池）】
- (a) 他牌品牌詞　(b) 明顯跨品類的蹭流量詞（跟本商品無關）　(c) 純編號／雜訊（如 0415）。
- 屬性詞、場景詞、賣點詞「不准」當成無關而排除。

【組裝】每個標題塞到 ${TITLE_MIN}–${TITLE_MAX} 字（中文 1 字＝1 元）；後段是關鍵字倉庫、用「空格」分隔堆疊；不強制任何框號【】符號；同一個詞最多出現 2 次；通順可讀、別堆到不能唸。
【字數不足時】回頭把競品的「次高頻品類／屬性變體」補進後段倉庫，直到 ≥ ${TITLE_MIN} 字，不要硬湊無關詞。

【紅線】
- 只萃取競品原文出現過的詞（必埋詞除外）。
- 絕對不出現任何品牌名（他牌一律不准，包括競品裡的品牌）。
- 不編造規格／材質／認證。
- 禁字（一個都不准）：${FORBIDDEN_WORDS.join('、')}。

每個標題務必落在 ${TITLE_MIN}–${TITLE_MAX} 字，寧可多塞高頻詞也不要短於 ${TITLE_MIN}。只輸出合法 JSON（不要 markdown 圍欄、不要解說）：
{ "titles": ["候選1", "候選2", "候選3"], "rationale": { "main": "主品類詞", "picked": [{ "keyword": "詞", "type": "品類|屬性|場景|服務", "count": 次數 }], "excluded": [{ "keyword": "詞", "reason": "他牌品牌詞|被涵蓋|與本品無關" }] } }`

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

// 某詞在標題出現幾次
function occurrences(t, kw) {
  if (!kw) return 0
  return t.split(kw).length - 1
}

// 優化標題的程式品檢（前後端同一套規則；前端 src/titleCheck.js 是同值鏡像供即時品檢）。
// keywords = { main, mustInclude:[] }
export function buildTitleChecks(title, keywords = {}) {
  const t = String(title || '')
  const main = String(keywords.main || '').trim()
  const must = (Array.isArray(keywords.mustInclude) ? keywords.mustInclude : []).map((s) => String(s || '').trim()).filter(Boolean)
  const len = titleLen(t)
  return {
    len,
    tooShort: len < TITLE_MIN,
    over: len > TITLE_MAX,
    mainFirst: main ? startsWithin(t, main, MAIN_KW_FRONT) : null,
    mustMissing: must.filter((k) => !t.includes(k)),
    blacklistHits: blacklistHits(t),
    forbiddenHits: FORBIDDEN_WORDS.filter((w) => t.includes(w)),
    repeats: [main, ...must].filter((k) => k && occurrences(t, k) > 2),
  }
}

// 標題候選是否過關（有不過關的就觸發後端重修，上限 REPAIR_LIMIT 次）。
function titleOk(c) {
  return (
    !c.tooShort &&
    !c.over &&
    c.mainFirst !== false &&
    c.mustMissing.length === 0 &&
    c.blacklistHits.length === 0 &&
    c.forbiddenHits.length === 0 &&
    c.repeats.length === 0
  )
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

function buildTitleUserText(body, competitors, mustInclude) {
  const lines = [
    '【商品品名】' + (isStr(body.productName) ? body.productName : '（未填）'),
  ]
  if (isStr(body.currentTitle)) lines.push('【現有標題（可參考、可改進）】' + body.currentTitle)
  lines.push('', '【競品標題（一行一條）】')
  competitors.forEach((t, i) => lines.push(`${i + 1}. ${t}`))
  lines.push('', `【必埋詞（每個候選都必須出現；沒有就當作無服務詞）】${mustInclude.join('、') || '（無）'}`)
  return lines.join('\n')
}

function parseTitleResult(raw) {
  const p = parseAnalysisText(raw)
  const titles = p && Array.isArray(p.titles) ? p.titles.filter(isStr).slice(0, CANDIDATE_COUNT) : []
  const rationale = p && p.rationale && typeof p.rationale === 'object' ? p.rationale : null
  return { titles, rationale }
}

// 字池：優先用 sanitizeRationale 的 picked（已過濾/去重/依次數排序）；不足再用競品切詞補。
function buildPool(pickedWords, competitors) {
  const pool = [...pickedWords]
  const toks = competitors
    .flatMap((t) => t.split(/\s+/))
    .map((s) => s.trim())
    .filter((k) => k && isFromTitles(k, competitors) && !classifyExclusion(k).exclude)
  for (const k of coverageDedup(toks)) if (!pool.includes(k)) pool.push(k)
  return pool
}

// 就地把標題補到合格：先補齊必埋詞，再從字池補高頻詞到 ≥TITLE_MIN（不超過 TITLE_MAX、不重複）。
export function enforceTitle(title, { main = '', mustInclude = [], pool = [] } = {}) {
  let t = String(title || '').trim()
  for (const m of mustInclude) {
    const k = String(m || '').trim()
    if (k && !t.includes(k) && titleLen(`${t} ${k}`) <= TITLE_MAX) t = `${t} ${k}`
  }
  for (const kw of pool) {
    if (titleLen(t) >= TITLE_MIN) break
    const k = String(kw || '').trim()
    if (!k || t.includes(k) || blacklistHits(k).length) continue
    const cand = `${t} ${k}`
    if (titleLen(cand) > TITLE_MAX) continue
    t = cand
  }
  return t
}

// 收斂候選：每句就地補字→只留「全過」的→去重→上限 count。寧缺勿濫，絕不輸出不合格的。
export function finalizeTitles(rawTitles, { main = '', mustInclude = [], pool = [], count = CANDIDATE_COUNT } = {}) {
  const out = []
  const seen = new Set()
  for (const raw of Array.isArray(rawTitles) ? rawTitles : []) {
    const t = enforceTitle(raw, { main, mustInclude, pool })
    if (seen.has(t)) continue
    if (titleOk(buildTitleChecks(t, { main, mustInclude }))) {
      seen.add(t)
      out.push(t)
    }
    if (out.length >= count) break
  }
  return out
}

// 後端重算 rationale（不信 AI 自報）：排除只認三類硬排除（他牌／服務承諾／純編號），
// 其餘 AI 想排除的、只要是競品原文出現過的詞一律「救回」字池（收窄過度排除，保護賣點屬性詞）。
// picked 過 substring 鐵律＋涵蓋去重＋獨立計次；excluded 理由改成教員工的句式。
export function sanitizeRationale(rationale, competitors) {
  const r = rationale || {}
  const pickedWords = []
  const pickedSet = new Set()
  const typeOf = {}
  const excluded = []
  const seenEx = new Set()
  const addExcluded = (keyword, reason) => {
    const k = String(keyword || '').trim()
    if (k && !seenEx.has(k)) {
      seenEx.add(k)
      excluded.push({ keyword: k, reason })
    }
  }
  // AI 的 picked 與 excluded 全部丟進同一套後端判定
  const consider = (keyword, aiType) => {
    const kw = String(keyword || '').trim()
    if (!kw) return
    const cls = classifyExclusion(kw)
    if (cls.exclude) {
      addExcluded(kw, cls.reason) // 硬排除三類 → excluded（教學理由）
      return
    }
    // 非硬排除 → 只要競品原文出現過就救回字池（即使 AI 想排除）
    if (isFromTitles(kw, competitors) && !pickedSet.has(kw)) {
      pickedSet.add(kw)
      pickedWords.push(kw)
      if (aiType) typeOf[kw] = aiType
    }
  }
  for (const x of Array.isArray(r.picked) ? r.picked : []) if (x && isStr(x.keyword)) consider(x.keyword, x.type)
  for (const x of Array.isArray(r.excluded) ? r.excluded : []) if (x && isStr(x.keyword)) consider(x.keyword, '')

  const kept = coverageDedup(pickedWords)
  const picked = kept.map((k) => ({ keyword: k, type: typeOf[k] || '', count: countIndependent(k, competitors, kept) }))
  picked.sort((a, b) => b.count - a.count)

  const mainOk =
    isStr(r.main) && isFromTitles(r.main.trim(), competitors) && !classifyExclusion(r.main.trim()).exclude
  const main = mainOk ? r.main.trim() : picked[0] ? picked[0].keyword : ''
  return { main, picked, excluded }
}

// 優化舊品·卡1：單次呼叫直出 2–3 個完整標題＋選字依據；品檢不過自動重修（上限 REPAIR_LIMIT 次）。
async function handleOptimizeTitle(env, body) {
  const competitors = normalizeTitles(body.competitorTitles)
  if (competitors.length === 0) return json({ error: '缺少競品標題（一行貼一條）' }, 400)
  const mustInclude = (Array.isArray(body.mustInclude) ? body.mustInclude : [])
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .slice(0, MUST_INCLUDE_MAX)

  const userText = buildTitleUserText(body, competitors, mustInclude)
  let spentInput = 0
  let spentOutput = 0
  async function call(messages) {
    const r = await callClaudeApi(env, { system: OPTIMIZE_TITLE_SYSTEM_PROMPT, messages, maxTokens: COPY_MAX_TOKENS })
    spentInput += r.inputTokens
    spentOutput += r.outputTokens
    return r.text
  }

  let titles = []
  let rationale = null
  const messages = [{ role: 'user', content: userText }]
  try {
    const first = await call(messages)
    const parsed = parseTitleResult(first)
    titles = parsed.titles
    rationale = parsed.rationale
    messages.push({ role: 'assistant', content: first })
  } catch (err) {
    await addUsage(env, spentInput, spentOutput)
    return json({ error: 'AI 產標題失敗：' + String(err && err.message ? err.message : err) }, 502)
  }

  // 收斂：每句就地補字→只留全過的。湊不滿 CANDIDATE_COUNT 就重修，最多 REPAIR_LIMIT 次。
  function finalize() {
    const san = sanitizeRationale(rationale, competitors)
    const pool = buildPool(san.picked.map((p) => p.keyword), competitors)
    const list = finalizeTitles(titles, { main: san.main, mustInclude, pool, count: CANDIDATE_COUNT })
    return { san, list }
  }

  let { san, list } = finalize()
  let tries = 0
  while (tries < REPAIR_LIMIT && list.length < CANDIDATE_COUNT) {
    tries += 1
    try {
      messages.push({
        role: 'user',
        content: `只給了 ${list.length} 個合格標題，請重出 ${CANDIDATE_COUNT} 個，每個都符合：${TITLE_MIN}–${TITLE_MAX} 字、主關鍵字放前 ${MAIN_KW_FRONT} 字內、必埋詞（${mustInclude.join('、') || '無'}）全部出現、無任何品牌名、無禁字、同一詞不超過 2 次。字數不足就補競品次高頻變體。只輸出原本 JSON 結構（titles＋rationale）。`,
      })
      const retryRaw = await call(messages)
      const parsed = parseTitleResult(retryRaw)
      if (parsed.titles.length) titles = parsed.titles
      if (parsed.rationale) rationale = parsed.rationale
      messages.push({ role: 'assistant', content: retryRaw })
      ;({ san, list } = finalize())
    } catch {
      break // 沿用上一版
    }
  }

  await addUsage(env, spentInput, spentOutput)
  // 寧缺勿濫：list 全部保證全過；一個都湊不出才回錯。
  if (list.length === 0) return json({ error: 'AI 忙線中，再按一次', budget: await buildBudget(env) }, 502)
  return json({
    titles: list,
    titleChecks: list.map((t) => buildTitleChecks(t, { main: san.main, mustInclude })),
    rationale: san,
    budget: await buildBudget(env),
  })
}
