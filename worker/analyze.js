// /api/analyze：呼叫 Anthropic vision 模型，把商品素材圖＋基本資料變成一份「分析卡 JSON」。
// 素材圖只用於這一次分析，不存 KV、不存 R2。

// 模型做成常數方便切換：品質不夠再升 'claude-sonnet-4-6'。
const MODEL = 'claude-haiku-4-5'
const MAX_TOKENS = 2500
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
逐張檢查上傳圖片：簡體字、浮水印、他牌 logo 或商標、嚴重低解析或模糊。輸出 material_check 陣列（index 對應上傳順序、usable 布林、issues 字串陣列；無問題給空陣列）。

## 輸出格式
嚴格依照以下 JSON 結構輸出（範例值僅示意）：
{ "product_analysis": { "category": "廚房用品", "product_main_color": { "hex": "#D4AF37", "name": "金色" }, "secondary_colors": [ { "hex": "#3B2F2F", "name": "深咖啡" } ] }, "palette": { "bg_gradient": ["#2C1F14", "#4A3421"], "bg_soft": ["#F5EDE3", "#EFE3D3"], "title_fill": "#FFD700", "title_fill_gradient": ["#FFE066", "#D4A017"], "title_shadow": "#3A2A10", "accent": "#C0392B", "rationale": "金色商品配深咖啡漸層底襯托質感，金黃主標與深底形成強對比" }, "palette_alt": { "bg_gradient": ["#1E3A2F", "#2F5D4A"], "bg_soft": ["#E8F2EC", "#DCEAE1"], "title_fill": "#FFC93C", "title_fill_gradient": null, "title_shadow": "#12241C", "accent": "#E8590C", "rationale": "墨綠底同樣能襯金色，亮黃主標保持跳色" }, "copy": { "main_title_options": ["…｜…", "…｜…", "…｜…"], "sub_title": "…", "hero_slogan": "…！", "selling_points": [ { "title": "…", "desc": "…" }, { "title": "…", "desc": "…" }, { "title": "…", "desc": "…" } ], "scenes": ["…", "…", "…"], "before_after": { "before_scene": "…", "after_scene": "…", "before_copy": "…", "after_copy": "…" }, "target_audience": "…" }, "material_check": [ { "index": 0, "usable": true, "issues": [] } ] }`

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

async function callClaude(env, messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: SYSTEM_PROMPT,
      messages,
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`anthropic ${res.status}: ${detail.slice(0, 300)}`)
  }
  const data = await res.json()
  return (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

export async function handleAnalyze(request, env) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: '後台尚未設定 AI 金鑰' }, 503)

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

  let raw
  try {
    raw = await callClaude(env, firstMessages)
  } catch (err) {
    return json({ error: 'AI 分析失敗：' + String(err && err.message ? err.message : err) }, 502)
  }

  let analysis = null
  try {
    const parsed = parseAnalysisText(raw)
    if (validateAnalysis(parsed)) analysis = parsed
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
      const retryRaw = await callClaude(env, retryMessages)
      const parsed = parseAnalysisText(retryRaw)
      if (validateAnalysis(parsed)) analysis = parsed
    } catch {
      // 落到下面的 502
    }
  }

  if (!analysis) return json({ error: 'AI 忙線中，再按一次' }, 502)
  return json({ analysis })
}
