// 白牌九圖模板引擎 v2：純函式、零 AI。
// 哲學翻轉：工具只給「策略」（品類/主賣點/關鍵動作/TA/調性），不給 hex/字級/座標——把配色、排版、質感的發揮權還給 GPT。
// 連貫性靠九張共用「同一句調性描述（tone）」，不再靠共用 hex。
// 戰場分級：Hero／規格死磕，選項圖／比較圖要對，中間放生區刻意寫鬆（充門面、能看即可）。
import { buildSpecRows, buildSpecImagePrompt } from './prompts.js'

// 每張卡片：slot 序號、tier 檔次、pickKey 素材分工鍵、label、materialsHint、prompt、textChecklist、warning?、chainNote?

// ===== 調性（連貫的唯一來源，取代舊的共用 hex）=====
// 由 TA + 品類推導一句調性方向詞，注入九張所有 prompt。員工可從下拉覆蓋。
const TA_PRESETS = ['女性向', '男性向', '通用']
export { TA_PRESETS }

export const TONE_OPTIONS = [
  '粉嫩療癒、柔和溫馨、女性感',
  '俐落質感、深色冷調、專業感',
  '乾淨清爽、明亮實用、生活感',
  '溫暖木質、自然質樸、居家感',
  '高級簡約、精品質感',
  '活潑繽紛、年輕有活力',
  '明亮活潑、乾淨有質感的電商風',
]

const TONE_RULES = [
  { g: '女性', cats: ['居家', '廚房', '餐廚', '美妝', '美容', '母嬰', '寵物', '飾品', '文具'], tone: '粉嫩療癒、柔和溫馨、女性感' },
  { g: '男性', cats: ['3C', '電子', '工具', '五金', '汽', '機車', '車', '運動', '戶外', '健身'], tone: '俐落質感、深色冷調、專業感' },
  { g: '*', cats: ['清潔', '收納', '家用', '生活', '衛浴', '廚房'], tone: '乾淨清爽、明亮實用、生活感' },
]
const TONE_FALLBACK = '明亮活潑、乾淨有質感的電商風'

export function deriveTone(gender, category = '') {
  const cat = String(category || '')
  for (const r of TONE_RULES) {
    if (r.g !== '*' && r.g !== gender) continue
    if (r.cats.some((c) => cat.includes(c))) return r.tone
  }
  return TONE_FALLBACK
}

function taGender(taStr = '') {
  const s = String(taStr)
  if (/女|媽|婦|妹|姐|小姐|太太/.test(s)) return '女性'
  if (/男|爸|哥|先生|型男/.test(s)) return '男性'
  return '通用'
}

function resolveTa(analysis, taPick) {
  if (taPick && TA_PRESETS.includes(taPick)) return taPick
  return (analysis.copy && analysis.copy.target_audience) || '一般消費者'
}

// 主標「上行｜下行」轉成給 GPT 的雙行語意描述。
function describeMainTitle(raw) {
  const parts = String(raw).split('｜').map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 2) return `雙行排版，上行「${parts[0]}」、下行「${parts[1]}」`
  return `「${parts[0] || raw}」`
}

// ===== 連貫鏈（半自動架構的落地細節：員工要手動搬上一張圖）=====
const CHAIN_MATERIALS = '商品實拍圖 ＋「上一張剛做好的圖」（當風格參考一起傳）'
const CHAIN_NOTE =
  '⚠️ 連貫關鍵：做這張時，把「上一張剛做好的圖」存下來、當風格參考圖一起傳給 GPT，並在開頭說「請延續前一張的風格與配色」。漏傳＝風格會跑掉。'

// ===== Hero（🔥 死磕）：從死規格改成策略簡報 =====
function buildHeroPrompt(s) {
  return `【商品主圖設計 — 蝦皮／MOMO 爆款風格】

請參考我另外附上的「版型參考圖」，只借用它的排版邏輯、視覺層級與廣告氛圍；商品完全換成我上傳的實拍商品，不得沿用參考圖的商品。

【這個商品是什麼】
${s.category}｜${s.productName}

【最重要的溝通重點】
主賣點是「${s.mainSellingPoint}」——這是消費者最該記住的一件事，畫面要圍繞它。

【主圖必須有的關鍵動作／畫面】
${s.keyAction}

【主標題】${s.mainTitle}（泡泡藝術字、雙行、活潑有記憶點）
【副標語】${s.subTitle}

【賣給誰／整體調性】
主要客群是 ${s.ta}，整體視覺走「${s.tone}」的感覺。配色、背景、光線、字體顏色都請你依這個調性自由發揮，選出最搭這個商品、最能讓它跳出來的方案——不用我指定色碼，你的判斷會比我準。

【畫面原則】
・商品是絕對主角，佔畫面約 65–70%，完整、不裁切、不變形。
・要真實商品攝影質感：自然陰影、材質反光、避免塑膠感與 AI 感，像 MOMO 官方商品攝影。
・只放 1 個最重要賣點的小標，其餘元素明顯小於商品、不搶主體、不遮擋商品。
・維持蝦皮爆款的高轉換張力（主標醒目、視覺層級分明），但要精緻、乾淨，不要廉價夜市海報感。

【硬規則】不要品牌 LOGO／浮水印／價格／促銷貼紙／出貨徽章；中文字必須完全正確、無錯字、無簡體。

【輸出】繁體中文、蝦皮爆款＋MOMO 商品頁風格、真實商品攝影、正方形 1:1、4K。`
}

// ===== 放生區（🌊）：短、鬆、只鎖主題＋調性＋保真 =====
function buildFillPrompt(label, theme, tone) {
  return `以我上傳的實拍為商品參考，保留商品真實外觀、材質、顏色（不重畫商品），做一張乾淨的蝦皮內頁「${label}」。
重點呈現：${theme}
整體走「${tone}」的調性，跟我這組商品的其他圖保持一致的感覺。
其餘配色、排版、構圖你自由發揮，乾淨好看、不要太怪、中文字正確即可。正方形 1:1。`
}

// ===== 比較圖（✅ 要對）：鬆綁「禁市售款」，允許跟傳統款做真實品類對比 =====
function buildComparePrompt(s) {
  const ba = s.beforeAfter || {}
  return `以我上傳的實拍為商品參考，保持商品外觀一致（不重畫商品），做一張「本商品 vs 傳統一般款」的左右對比圖。

・左半「本商品（勝）」：${ba.after_scene || '使用本商品的順手、輕鬆'}；本商品清楚入鏡、使用中狀態。短文案（≤12 字）：${ba.after_copy || ''}
・右半「傳統／一般款」：${ba.before_scene || '傳統同類品的不便'}；用中性的「一般款／傳統款」代表，此側不出現本商品。短文案（≤12 字）：${ba.before_copy || ''}
・中間：由本商品指向勝出的 VS 標示。

【硬規則】
・可以跟「傳統／一般款同類產品」做對比（例：軟矽膠 vs 硬塑膠冰格盤），呈現本商品的優勢。
・嚴禁指名道姓打任何「特定品牌」；對照方只能是中性的「一般款／傳統款」品類代表。
・嚴禁捏造任何數據、百分比、檢測數字。
・對照差異只能基於真實的品類特性，不得虛構缺點。
・繁體中文、無錯字、正方形 1:1。整體維持與其他圖一致的「${s.tone}」調性。`
}

// ===== 選項圖（✅ 要對）：去背純白底、不得改色 =====
function buildOptionPrompt(color) {
  return `以我上傳的${color}實拍照片為準，商品外觀與顏色完全保留。去背，純白背景，正方形 1:1，電商選項展示用。不得更動商品顏色。`
}

// buildNine(product, specs, analysis, choices?) → { cards: Card[8], optionCards: Card[N], tone }
// choices = { sellingPointPick, mainTitlePick, customMainTitle, taPick, keyActionPick, customKeyAction, toneOverride }
export function buildNine(product, specs, analysis, choices = {}) {
  const copy = analysis.copy || {}
  const picks = analysis.image_picks || {}
  const pickNote = (i) => (Number.isInteger(i) ? `（AI 建議：用你上傳的第 ${i + 1} 張）` : '')

  const category = (analysis.product_analysis && analysis.product_analysis.category) || product.material || '商品'
  const productName = product.name || '商品'

  // 主賣點
  const sp = Array.isArray(copy.selling_points) ? copy.selling_points : []
  const spIdx = Number.isInteger(choices.sellingPointPick) && sp[choices.sellingPointPick] ? choices.sellingPointPick : 0
  const mainSellingPoint = (sp[spIdx] && sp[spIdx].title) || (sp[0] && sp[0].title) || '（主賣點）'

  // 主標題
  const titleOptions = copy.main_title_options || []
  const rawTitle =
    String(choices.customMainTitle || '').trim() ||
    titleOptions[choices.mainTitlePick || 0] ||
    titleOptions[0] ||
    '（未填主標題）'
  const titleParts = rawTitle.split('｜').map((t) => t.trim()).filter(Boolean)

  // 關鍵動作
  const kaOptions = Array.isArray(copy.key_action_options) ? copy.key_action_options : []
  const keyAction =
    String(choices.customKeyAction || '').trim() ||
    kaOptions[choices.keyActionPick || 0] ||
    kaOptions[0] ||
    '呈現最能體現主賣點的使用瞬間'

  // TA + 調性（連貫錨）
  const ta = resolveTa(analysis, choices.taPick)
  const tone = String(choices.toneOverride || '').trim() || deriveTone(taGender(ta), category)

  const scenes = Array.isArray(copy.scenes) ? copy.scenes : []
  const material = product.material || ''

  const s = {
    category,
    productName,
    mainSellingPoint,
    mainTitle: describeMainTitle(rawTitle),
    subTitle: copy.sub_title || '',
    keyAction,
    ta,
    tone,
    scenes,
    sellingPoints: sp,
    beforeAfter: copy.before_after || {},
  }

  const cards = []

  // 槽 1｜Hero 主圖 🔥
  cards.push({
    slot: 1,
    tier: 'core',
    pickKey: 'hero',
    label: 'Hero 主圖',
    materialsHint: `商品實拍主圖${pickNote(picks.hero)}＋版型參考圖（本卡片可下載）`,
    prompt: buildHeroPrompt(s),
    textChecklist: [
      ...titleParts.map((t, i) => `主標${i === 0 ? '上行' : '下行'}：${t}`),
      `副標：${s.subTitle}`,
      `主賣點小標：${mainSellingPoint}`,
    ],
  })

  // 槽 2–6｜放生區 🌊（使用方式／材質／細節特寫／情境A／情境B）
  const fill = [
    { label: '使用方式圖', pickKey: 'intro', theme: `這個商品怎麼用（${keyAction}）` },
    {
      label: '材質／品質圖',
      pickKey: 'intro',
      theme: `用什麼做的、好在哪${material ? `（${material}` : '（'}${sp[0] ? `${material ? '、' : ''}${sp[0].title}` : ''}）`,
    },
    { label: '細節特寫圖', pickKey: 'intro', theme: '商品最值得放大看的部位或做工細節' },
    { label: '情境圖 A', pickKey: 'scene', theme: `放在「${scenes[0] || '生活場景'}」的生活情境裡的樣子` },
    { label: '情境圖 B', pickKey: 'scene', theme: `換一個場景：「${scenes[1] || '另一個生活場景'}」` },
  ]
  fill.forEach((f, i) => {
    const isScene = f.pickKey === 'scene'
    cards.push({
      slot: 2 + i,
      tier: 'fill',
      pickKey: f.pickKey,
      label: f.label,
      materialsHint: `${CHAIN_MATERIALS}${pickNote(picks[f.pickKey])}`,
      prompt: buildFillPrompt(f.label, f.theme, tone),
      textChecklist: [],
      chainNote: CHAIN_NOTE,
      warning: isScene ? '這張不該有大量文字，畫面以商品與場景為主' : undefined,
    })
  })

  // 槽 7｜比較圖 ✅
  cards.push({
    slot: 7,
    tier: 'ok',
    pickKey: 'compare',
    label: '比較圖（vs 傳統款）',
    materialsHint: `${CHAIN_MATERIALS}${pickNote(picks.compare)}`,
    prompt: buildComparePrompt(s),
    textChecklist: ['小標：本商品／傳統款', `本商品文案：${s.beforeAfter.after_copy || ''}`, `傳統款文案：${s.beforeAfter.before_copy || ''}`],
    chainNote: CHAIN_NOTE,
  })

  // 槽 8｜尺寸規格圖 🔥（數字人填，沿用現狀，只加調性呼應、不注入 hex）
  const specRows = buildSpecRows(product, specs)
  cards.push({
    slot: 8,
    tier: 'core',
    pickKey: 'spec',
    label: '尺寸規格圖',
    materialsHint: `白底商品圖${pickNote(picks.spec)}`,
    prompt:
      buildSpecImagePrompt(product, specs) +
      `\n\n【調性呼應】規格表的標題或分隔線可用與整套一致的「${tone}」調性做點綴，但底維持白底、數字維持黑字清楚可讀。`,
    textChecklist: specRows,
    warning: '⚠️ 數字錯一個字＝客訴，逐字核對',
  })

  // 選項圖 ×N（第 9 類，✅ 要對）：依商品顏色每色一張
  const colors = Array.isArray(product.colors) ? product.colors : []
  const optionCards = colors.map((color, i) => ({
    slot: `option-${i}`,
    tier: 'ok',
    label: `選項圖｜${color}`,
    materialsHint: `${color} 商品實拍圖`,
    prompt: buildOptionPrompt(color),
    textChecklist: [],
  }))

  return { cards, optionCards, tone }
}
