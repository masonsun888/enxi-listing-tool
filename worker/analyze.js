// /api/analyze：呼叫 Anthropic vision 模型，把商品素材圖＋基本資料變成一份「分析卡 JSON」。
// 素材圖只用於這一次分析，不存 KV、不存 R2。

// 模型做成常數方便切換：品質不夠再升 'claude-sonnet-4-6'。
const MODEL = 'claude-haiku-4-5'
const MAX_TOKENS = 3000
const TEMPERATURE = 0.2
const MAX_IMAGES = 4
const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' }

const SYSTEM_PROMPT = `你是「恩希貿易」的電商視覺分析引擎。使用者會提供商品素材圖與基本資料，你要輸出一份 JSON 分析卡，供下游系統組裝蝦皮爆款商品圖的製圖指令。只輸出合法 JSON：不要 markdown 圍欄、不要任何解說文字。

## 任務一：商品主色提取
觀察「商品本體」佔最大面積的顏色（忽略背景、浮水印、包裝、陰影），輸出 hex 與中文色名。多色商品取視覺主導色，其餘列入 secondary_colors。

## 任務二：配色方案（嚴格依下列色彩學規則，禁止自由發揮）
目標：商品是絕對主角、主標泡泡字必須跳出來、整體為蝦皮爆款的高飽和活潑感。

1. 背景 bg_gradient（輸出兩個 hex，做柔和漸層）：
   - 取商品主色的互補色或強對比色系；中高明度、中低飽和，商品的飽和度必須高於背景。
   - 深色商品（黑／深灰／深藍／酒紅）→ 亮暖背景（奶油黃、淺橘、暖米色系）。
   - 白色／淺色商品 → 中等飽和的彩色背景（蜜桃橘、湖水綠、天空藍系），嚴禁純白或淺灰背景（商品會糊掉）。
   - 金色／香檳／銅色商品 → 深色背景襯托質感（深咖啡、墨綠、藏青系）。
   - 銀色／不鏽鋼商品 → 藍色系或暖橘背景（冷暖對比）。
   - 高彩度商品（正紅／亮黃／亮綠等）→ 同色系淺色漸層，或互補色的低飽和版。
2. 主標填色 title_fill：高飽和、與背景強對比；通常取商品主色的加強飽和版，或其互補強調色。金色商品可另給 title_fill_gradient（兩個 hex 的金黃漸層），其餘商品 title_fill_gradient 設為 null。
3. 強調色 accent：與 title_fill 不同、但同色溫（同暖或同冷），供副標筆刷底、情境標語、比較圖箭頭使用。
4. bg_soft：bg_gradient 的淺化低飽和版（兩個 hex），供內頁介紹圖背景使用。
5. 【絕對禁止】莫蘭迪、灰粉、霧霾藍、大地文青色等低飽和性冷淡色系；主標填色與背景同色系同明度；背景比商品搶眼。
6. 輸出前自我檢查：(a) 商品與背景對比足夠嗎？(b) 主標填色與背景對比足夠嗎？(c) 整體維持高飽和活潑感嗎？任一不足就調整後再輸出。
7. 另外輸出一組風格不同、但同樣符合以上全部規則的備選配色 palette_alt（結構與 palette 相同）。

## 任務三：文案素材（全部繁體中文）
只能根據圖中可見特徵與使用者提供的真實資料撰寫，禁止編造規格、材質等級、功能、認證（例：使用者沒說 316 就不准寫 316）。
- main_title_options：3 個主標候選。雙行結構，用「｜」分隔上下行，每行 ≤6 字，口語、有記憶點、含品類詞，蝦皮爆款口吻。例：「小貓保溫杯｜萌翻辦公室」。
- sub_title：一句 ≤12 字的利益點。例：輕鬆洗到底、秒收納不佔位。
- hero_slogan：≤6 字、帶驚嘆號的行動標語。例：超省空間！
- selling_points：3 個，各含 title（≤6 字）與 desc（≤15 字）。
- scenes：3 個具體使用場景（各 ≤10 字），彼此不同。例：明亮廚房中島。
- before_after：
  - before_scene：使用本商品「之前」的困擾情境描述（一句）。
  - after_scene：使用本商品「之後」的改善情境描述（一句）。
  - before_copy／after_copy：各 ≤12 字的畫面短文案。
  - 禁止杜撰任何數據、百分比或比較對象。
- target_audience：一句話描述目標客群。

## 任務四：素材健檢
逐張檢查上傳圖片：簡體字、浮水印、他牌 logo 或商標、嚴重低解析或模糊、手機或網頁截圖（畫面含狀態列、按鈕、購物網站介面等元素）。輸出 material_check 陣列（index 對應上傳順序、usable 布林、issues 字串陣列；無問題給空陣列）。

## 任務五：素材分工建議
就上傳的圖片（index 對應上傳順序，從 0 開始），建議每一種製圖用哪一張最合適，輸出 image_picks：
- hero：最適合當主圖素材的一張（商品完整、清晰、角度佳）。
- intro：最適合做賣點介紹圖的一張（有功能部位細節者優先）。
- scene：最適合做情境圖的一張（商品乾淨完整者優先）。
- spec：最適合做規格圖的一張（白底或近白底者優先）。
- compare：最適合做使用前後比較圖的一張。
- rationale：一句話說明分工理由。
只能從 usable 的圖片中挑；沒有合適的該項給 null；只有一張可用圖時全部給該張的 index。

## 任務六：規格轉錄（只抄不猜）
逐張檢查圖片上「明確可見」的規格文字，輸出 spec_hints：capacity（容量）、weight（重量）、diameter（口徑）、height（高度）、bottom_width（底寬）。只轉錄圖上實際印出的數字與單位、原樣照抄（例：圖上印 500ml 就輸出 "500ml"）；看不清楚或沒有標示就給 null。嚴禁推測、換算或補全。這些值僅供人工核對提示，不會被直接採用。

## 輸出格式
嚴格依照以下 JSON 結構輸出（範例值僅示意）：
{ "product_analysis": { "category": "廚房用品", "product_main_color": { "hex": "#D4AF37", "name": "金色" }, "secondary_colors": [ { "hex": "#3B2F2F", "name": "深咖啡" } ] }, "palette": { "bg_gradient": ["#2C1F14", "#4A3421"], "bg_soft": ["#F5EDE3", "#EFE3D3"], "title_fill": "#FFD700", "title_fill_gradient": ["#FFE066", "#D4A017"], "title_shadow": "#3A2A10", "accent": "#C0392B", "rationale": "金色商品配深咖啡漸層底襯托質感，金黃主標與深底形成強對比" }, "palette_alt": { "bg_gradient": ["#1E3A2F", "#2F5D4A"], "bg_soft": ["#E8F2EC", "#DCEAE1"], "title_fill": "#FFC93C", "title_fill_gradient": null, "title_shadow": "#12241C", "accent": "#E8590C", "rationale": "墨綠底同樣能襯金色，亮黃主標保持跳色" }, "copy": { "main_title_options": ["…｜…", "…｜…", "…｜…"], "sub_title": "…", "hero_slogan": "…！", "selling_points": [ { "title": "…", "desc": "…" }, { "title": "…", "desc": "…" }, { "title": "…", "desc": "…" } ], "scenes": ["…", "…", "…"], "before_after": { "before_scene": "…", "after_scene": "…", "before_copy": "…", "after_copy": "…" }, "target_audience": "…" }, "material_check": [ { "index": 0, "usable": true, "issues": [] } ], "image_picks": { "hero": 0, "intro": 1, "scene": 0, "spec": 2, "compare": 0, "rationale": "第1張商品最完整，第3張白底適合規格圖" }, "spec_hints": { "capacity": "500ml", "weight": null, "diameter": null, "height": "20cm", "bottom_width": null } }`

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS })
}

function isStr(v) {
  return typeof v === 'string' && v.length > 0
}

function isHexPair(v) {
  return Array.isArray(v) && v.length === 2 && v.every(isStr)
}

function validPalette(p) {
  return (
    p &&
    typeof p === 'object' &&
    isHexPair(p.bg_gradient) &&
    isHexPair(p.bg_soft) &&
    isStr(p.title_fill) &&
    isStr(p.title_shadow) &&
    isStr(p.accent)
  )
}

// 最小 schema 驗證：缺欄位視同解析失敗（呼叫端會走重試）。
export function validateAnalysis(a) {
  if (!a || typeof a !== 'object') return false
  if (!validPalette(a.palette) || !validPalette(a.palette_alt)) return false
  const c = a.copy
  if (!c || typeof c !== 'object') return false
  if (!Array.isArray(c.main_title_options) || c.main_title_options.length !== 3) return false
  if (!c.main_title_options.every(isStr)) return false
  if (!isStr(c.sub_title) || !isStr(c.hero_slogan)) return false
  if (!Array.isArray(c.selling_points) || c.selling_points.length !== 3) return false
  if (!c.selling_points.every((sp) => sp && isStr(sp.title) && isStr(sp.desc))) return false
  if (!Array.isArray(c.scenes) || c.scenes.length !== 3 || !c.scenes.every(isStr)) return false
  const ba = c.before_after
  if (!ba || !isStr(ba.before_scene) || !isStr(ba.after_scene) || !isStr(ba.before_copy) || !isStr(ba.after_copy))
    return false
  if (!Array.isArray(a.material_check)) return false
  return true
}

// 新增欄位（素材分工、規格提示）採寬鬆處理：缺了或格式怪就補 null，
// 不列入 validateAnalysis 的必填——避免為了加值功能多花一次重試的錢。
export function normalizeAnalysis(a) {
  const idx = (v) => (Number.isInteger(v) && v >= 0 && v < MAX_IMAGES ? v : null)
  const p = a.image_picks || {}
  a.image_picks = {
    hero: idx(p.hero),
    intro: idx(p.intro),
    scene: idx(p.scene),
    spec: idx(p.spec),
    compare: idx(p.compare),
    rationale: typeof p.rationale === 'string' ? p.rationale : '',
  }
  const s = a.spec_hints || {}
  const hint = (v) => (isStr(v) ? v : null)
  a.spec_hints = {
    capacity: hint(s.capacity),
    weight: hint(s.weight),
    diameter: hint(s.diameter),
    height: hint(s.height),
    bottom_width: hint(s.bottom_width),
  }
  return a
}

// ===== AI 額度追蹤（存 KV，按台灣時區月份歸戶）=====
// 注意：只統計「本工具」的 /api/analyze 花費；同一把 API key 若還有別的工具在用，那邊的錢不會算進來。
const PRICING_USD_PER_MTOK = { input: 1.0, output: 5.0 } // claude-haiku-4-5；換模型記得同步改
const USD_TO_TWD = 32
const DEFAULT_MONTHLY_BUDGET_TWD = 300
const USAGE_PREFIX = 'usage:analyze:'

// 台灣時區（UTC+8）的年月，額度每月 1 號自動歸零（換 key 即歸零，不用排程）。
export function monthKey(now = Date.now()) {
  return new Date(now + 8 * 3600 * 1000).toISOString().slice(0, 7)
}

export function costTWD(inputTokens, outputTokens) {
  const usd =
    (inputTokens * PRICING_USD_PER_MTOK.input + outputTokens * PRICING_USD_PER_MTOK.output) / 1e6
  return usd * USD_TO_TWD
}

function budgetLimitTWD(env) {
  const v = parseFloat(env.ANALYZE_MONTHLY_BUDGET_TWD)
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_MONTHLY_BUDGET_TWD
}

async function readUsageRecord(env) {
  const raw = await env.PRODUCTS.get(USAGE_PREFIX + monthKey())
  if (!raw) return { calls: 0, inputTokens: 0, outputTokens: 0 }
  try {
    const rec = JSON.parse(raw)
    return {
      calls: rec.calls || 0,
      inputTokens: rec.inputTokens || 0,
      outputTokens: rec.outputTokens || 0,
    }
  } catch {
    return { calls: 0, inputTokens: 0, outputTokens: 0 }
  }
}

export async function addUsage(env, inputTokens, outputTokens) {
  if (!env.PRODUCTS || (!inputTokens && !outputTokens)) return
  try {
    const rec = await readUsageRecord(env)
    rec.calls += 1
    rec.inputTokens += inputTokens
    rec.outputTokens += outputTokens
    rec.updatedAt = Date.now()
    await env.PRODUCTS.put(USAGE_PREFIX + monthKey(), JSON.stringify(rec))
  } catch {
    // 記帳失敗不影響分析結果
  }
}

// 給前端進度條用的額度摘要。KV 沒綁定（本機開發）時 tracked=false，前端不顯示、也不鎖。
export async function buildBudget(env) {
  const limitTWD = budgetLimitTWD(env)
  if (!env.PRODUCTS) {
    return { month: monthKey(), calls: 0, usedTWD: 0, limitTWD, percent: 0, tracked: false }
  }
  const rec = await readUsageRecord(env)
  const usedTWD = Math.round(costTWD(rec.inputTokens, rec.outputTokens) * 100) / 100
  return {
    month: monthKey(),
    calls: rec.calls,
    usedTWD,
    limitTWD,
    percent: Math.min(100, Math.round((usedTWD / limitTWD) * 100)),
    tracked: true,
  }
}

// 去除 ``` 圍欄後 parse；失敗丟例外。
export function parseAnalysisText(text) {
  let t = String(text || '').trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```\s*$/, '')
  }
  return JSON.parse(t)
}

function buildUserText(product = {}) {
  const colors =
    Array.isArray(product.colors) && product.colors.length > 0 ? product.colors.join('、') : '（未填）'
  return [
    '【商品基本資料】',
    `品名：${product.name || '（未填）'}`,
    `材質：${product.material || '（未填）'}`,
    `顏色：${colors}`,
    `容量/尺寸：${product.size || '（未填）'}`,
  ].join('\n')
}

// 共用的 Anthropic 呼叫：/api/analyze 與 /api/copy 都走這裡（同模型、同記帳邏輯）。
export async function callClaudeApi(env, { system, messages, maxTokens = MAX_TOKENS }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: TEMPERATURE,
      system,
      messages,
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`anthropic ${res.status}: ${detail.slice(0, 300)}`)
  }
  const data = await res.json()
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
  const usage = data.usage || {}
  return {
    text,
    inputTokens:
      (usage.input_tokens || 0) +
      (usage.cache_creation_input_tokens || 0) +
      (usage.cache_read_input_tokens || 0),
    outputTokens: usage.output_tokens || 0,
  }
}

function callClaude(env, messages) {
  return callClaudeApi(env, { system: SYSTEM_PROMPT, messages })
}

export async function handleAnalyze(request, env) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: '後台尚未設定 AI 金鑰' }, 503)

  // 額度鎖：本月花費達上限就直接擋下，不呼叫 AI。
  const budgetBefore = await buildBudget(env)
  if (budgetBefore.tracked && budgetBefore.usedTWD >= budgetBefore.limitTWD) {
    return json(
      {
        error: `本月 AI 分析額度已用完（NT$${budgetBefore.usedTWD} / NT$${budgetBefore.limitTWD}），下月 1 號自動重置`,
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

  const product = body.product || {}
  const rawImages = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : []
  if (rawImages.length === 0) return json({ error: '缺少商品素材圖' }, 400)

  const imageBlocks = []
  for (const img of rawImages) {
    if (!img || !isStr(img.data)) return json({ error: '圖片資料格式錯誤' }, 400)
    const mediaType = ALLOWED_MEDIA_TYPES.includes(img.media_type) ? img.media_type : 'image/jpeg'
    // 前端理論上只送純 base64，這裡保險再剝一次 data URL 前綴。
    const data = img.data.replace(/^data:[^;]+;base64,/, '')
    imageBlocks.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data } })
  }

  const firstMessages = [
    { role: 'user', content: [{ type: 'text', text: buildUserText(product) }, ...imageBlocks] },
  ]

  // 兩次呼叫（含重試）的 token 都要記帳——失敗的呼叫一樣有花錢。
  let spentInput = 0
  let spentOutput = 0

  let raw
  try {
    const first = await callClaude(env, firstMessages)
    raw = first.text
    spentInput += first.inputTokens
    spentOutput += first.outputTokens
  } catch (err) {
    await addUsage(env, spentInput, spentOutput)
    return json({ error: 'AI 分析失敗：' + String(err && err.message ? err.message : err) }, 502)
  }

  let analysis = null
  try {
    const parsed = parseAnalysisText(raw)
    if (validateAnalysis(parsed)) analysis = normalizeAnalysis(parsed)
  } catch {
    // 走下面的重試
  }

  if (!analysis) {
    // 重試一次：把上次輸出丟回去，要求只輸出合法 JSON。
    try {
      const retryMessages = [
        ...firstMessages,
        { role: 'assistant', content: raw || '（空白輸出）' },
        { role: 'user', content: '你上次輸出不是合法 JSON 或缺少必填欄位。請重新輸出：只輸出完整合法的 JSON，不要 markdown 圍欄、不要任何解說文字。' },
      ]
      const retry = await callClaude(env, retryMessages)
      spentInput += retry.inputTokens
      spentOutput += retry.outputTokens
      const parsed = parseAnalysisText(retry.text)
      if (validateAnalysis(parsed)) analysis = normalizeAnalysis(parsed)
    } catch {
      // 落到下面的 502
    }
  }

  await addUsage(env, spentInput, spentOutput)

  if (!analysis) return json({ error: 'AI 忙線中，再按一次', budget: await buildBudget(env) }, 502)
  return json({ analysis, budget: await buildBudget(env) })
}
