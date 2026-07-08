// 新品九圖模板引擎 v3：純函式、零 AI。
// 哲學再翻轉（實測驅動）：v2 的「策略簡報」方向對，但「簡報太完整＝稀釋 GPT 注意力」，質感只到及格。
// v3 把 Hero 收斂成「最關鍵的五句」——多一個字都是稀釋。畫面原則、質感錨點、輸出長串通通刪。
// 相信 GPT Image 2 的內建品味：「TA 女性」四個字，它自己會配美甲＋質感道具＋粉嫩調，不必替它列清單。
// 連貫靠一句短調性錨（TONE_MAP），不靠 hex、不靠版型。
import { buildSpecRows, buildSpecImagePrompt } from './prompts.js'

// 每張卡片：slot 序號、tier 檔次、pickKey 素材分工鍵、label、materialsHint、prompt、textChecklist、warning?、chainNote?

// ===== 調性錨（九張的唯一連貫來源）=====
// 由 TA + 品類推導「一句短白話」，直接當作 ${ta} 注入九張。刻意寫成白話（「女性、粉嫩療癒」），
// 不寫成「整體視覺走 XXX 調性方向」那種文謅謅的（那是 v2 稀釋寫法）。
const TA_PRESETS = ['女性向', '男性向', '通用']
export { TA_PRESETS }

// 下拉可選的調性錨（PR3 勾選卡用）。維持極短。
export const TONE_OPTIONS = ['女性、粉嫩療癒', '男性、俐落質感深色調', '通用、乾淨明亮生活感', '乾淨有質感的電商風']

// TONE_MAP：TA（性別）＋品類 → 一句短調性錨。
const TONE_MAP = [
  { g: '女性', cats: ['居家', '廚房', '餐廚', '美妝', '美容', '母嬰', '寵物', '飾品', '文具'], tone: '女性、粉嫩療癒' },
  { g: '男性', cats: ['3C', '電子', '工具', '五金', '汽', '機車', '車', '運動', '戶外', '健身'], tone: '男性、俐落質感深色調' },
  { g: '*', cats: ['清潔', '收納', '家用', '生活', '衛浴', '廚房'], tone: '通用、乾淨明亮生活感' },
]
const TONE_FALLBACK = '乾淨有質感的電商風'

export function deriveTone(gender, category = '') {
  const cat = String(category || '')
  for (const r of TONE_MAP) {
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

// 勾選的 TA（女性向/男性向/通用）或分析卡的 target_audience → 性別，供 deriveTone 用。
function resolveGender(analysis, taPick) {
  if (taPick && TA_PRESETS.includes(taPick)) {
    if (taPick.startsWith('女')) return '女性'
    if (taPick.startsWith('男')) return '男性'
    return '通用'
  }
  return taGender((analysis.copy && analysis.copy.target_audience) || '')
}

// 主標「上｜下」轉成 Hero 裡的一行短寫（雙行用「／」接，維持精簡）。
function compactMainTitle(raw) {
  return (
    String(raw)
      .split('｜')
      .map((s) => s.trim())
      .filter(Boolean)
      .join('／') || String(raw)
  )
}

// ===== 連貫鏈（半自動架構的落地細節：員工要手動搬上一張圖）=====
const CHAIN_MATERIALS = '商品實拍圖 ＋「上一張剛做好的圖」（當風格參考一起傳）'
const CHAIN_NOTE =
  '⚠️ 連貫關鍵：做下一張時，把上一張存下來、當參考圖一起傳給 GPT，並說「延續前一張風格」。漏傳＝風格跑掉。'

// ===== Hero（🔥 死磕）：五句濃縮，砍掉 v2 的畫面原則／質感錨點／輸出長串 =====
// 就這五句 + 一句參考圖引用 + 一句禁止項。多寫＝稀釋，質感反而掉。
function buildHeroPrompt(s) {
  return `【商品主圖設計 — 蝦皮／MOMO 爆款風格】
請參考我附上的「版型參考圖」，只借用它的排版邏輯與廣告氛圍；商品換成我上傳的實拍商品。

商品比例佔 65–70%
主標題「${s.mainTitle}」
主要賣點是「${s.mainSellingPoint}」${s.sellingPointOrder}
主圖要有「${s.keyAction}」的動作
主要 TA 是 ${s.ta}，配色背景以 ${s.ta} 為主

不要品牌 LOGO／浮水印／價格／促銷貼紙；中文字必須完全正確、無錯字、無簡體。正方形 1:1。`
}

// ===== 放生區（🌊）：只鎖主題＋調性＋保真，其餘全放手 =====
function buildFillPrompt(theme, ta) {
  return `以我上傳的實拍為商品參考，保留真實外觀材質顏色（不重畫），做一張蝦皮內頁「${theme}」圖。
主要 TA 是 ${ta}，配色以 ${ta} 為主，跟這組其他圖保持一致感覺。
其餘你自由發揮，乾淨好看、中文字正確。正方形 1:1。`
}

// ===== 比較圖（✅ 要對）：走五句精神，講重點別堆細節；鬆綁「禁一般款」但禁指名品牌／禁數據 =====
function buildComparePrompt(s) {
  const ba = s.beforeAfter || {}
  return `以我上傳的實拍為商品參考，保持商品外觀一致（不重畫），做一張「本商品 vs 傳統一般款」的左右對比圖。
・左半「本商品（勝）」：${ba.after_scene || '使用本商品的順手輕鬆'}；本商品清楚入鏡。短標（≤12字）：${ba.after_copy || ''}
・右半「傳統／一般款」：${ba.before_scene || '傳統同類品的不便'}；用中性的「一般款／傳統款」代表，不出現本商品。短標（≤12字）：${ba.before_copy || ''}
・中間：由本商品指向勝出的 VS 標示。
可跟「傳統／一般款同類產品」做真實品類對比（例：軟矽膠 vs 硬冰格盤）；嚴禁指名道姓打任何「特定品牌」；嚴禁捏造任何數據、百分比；不得虛構缺點。
主要 TA 是 ${s.ta}，配色以 ${s.ta} 為主。繁體中文、無錯字、正方形 1:1。`
}

// ===== 選項圖（✅ 要對）：去背純白底、不得改色 =====
function buildOptionPrompt(color) {
  return `以我上傳的${color}實拍照片為準，商品外觀與顏色完全保留。去背，純白背景，正方形 1:1，電商選項展示用。不得更動商品顏色。`
}

// buildNine(product, specs, analysis, choices?) → { cards: Card[8], optionCards: Card[N], tone }
// choices = { sellingPointPick, secondarySellingPick, noSecondary, mainTitlePick, customMainTitle,
//             taPick, keyActionPick, customKeyAction, toneOverride }
export function buildNine(product, specs, analysis, choices = {}) {
  const copy = analysis.copy || {}
  const picks = analysis.image_picks || {}
  const pickNote = (i) => (Number.isInteger(i) ? `（AI 建議：用你上傳的第 ${i + 1} 張）` : '')

  const category = (analysis.product_analysis && analysis.product_analysis.category) || product.material || '商品'

  // 主賣點（含主次）
  const sp = Array.isArray(copy.selling_points) ? copy.selling_points : []
  const spIdx = Number.isInteger(choices.sellingPointPick) && sp[choices.sellingPointPick] ? choices.sellingPointPick : 0
  const mainSellingPoint = (sp[spIdx] && sp[spIdx].title) || (sp[0] && sp[0].title) || '（主賣點）'

  // 次要賣點：員工指定；未指定則預設抓下一個不同的賣點。可用 noSecondary 關掉。
  let secondary = ''
  if (!choices.noSecondary) {
    if (
      Number.isInteger(choices.secondarySellingPick) &&
      choices.secondarySellingPick !== spIdx &&
      sp[choices.secondarySellingPick] &&
      sp[choices.secondarySellingPick].title
    ) {
      secondary = sp[choices.secondarySellingPick].title
    } else {
      const other = sp.find((x, i) => i !== spIdx && x && x.title)
      secondary = other ? other.title : ''
    }
  }
  const sellingPointOrder = secondary ? `，${secondary} 是次要` : ''

  // 主標題（短才有力）
  const titleOptions = copy.main_title_options || []
  const rawTitle =
    String(choices.customMainTitle || '').trim() ||
    titleOptions[choices.mainTitlePick || 0] ||
    titleOptions[0] ||
    '（未填主標題）'
  const titleParts = rawTitle.split('｜').map((t) => t.trim()).filter(Boolean)

  // 關鍵動作（帶落點）
  const kaOptions = Array.isArray(copy.key_action_options) ? copy.key_action_options : []
  const keyAction =
    String(choices.customKeyAction || '').trim() ||
    kaOptions[choices.keyActionPick || 0] ||
    kaOptions[0] ||
    '呈現最能體現主賣點的使用瞬間'

  // 調性錨（連貫的唯一來源，直接當 ${ta} 白話注入九張）
  const gender = resolveGender(analysis, choices.taPick)
  const ta = String(choices.toneOverride || '').trim() || deriveTone(gender, category)

  const scenes = Array.isArray(copy.scenes) ? copy.scenes : []
  const material = product.material || ''

  const s = {
    mainSellingPoint,
    sellingPointOrder,
    mainTitle: compactMainTitle(rawTitle),
    keyAction,
    ta,
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
      ...titleParts.map((t, i) => `主標${titleParts.length > 1 ? (i === 0 ? '上行' : '下行') : ''}：${t}`),
      `主賣點小標：${mainSellingPoint}`,
    ],
  })

  // 槽 2–6｜放生區 🌊（使用方式／材質／細節特寫／情境A／情境B），指令刻意寫鬆、無 textChecklist
  const fill = [
    { label: '使用方式圖', pickKey: 'intro', theme: `這個商品怎麼用（${keyAction}）` },
    {
      label: '材質／品質圖',
      pickKey: 'intro',
      theme: `用什麼做的、好在哪${material ? `（${material}` : '（'}${sp[0] ? `${material ? '、' : ''}${sp[0].title}` : ''}）`,
    },
    { label: '細節特寫圖', pickKey: 'intro', theme: '商品最值得放大看的部位或做工細節' },
    { label: '情境圖 A', pickKey: 'scene', theme: `放在「${scenes[0] || '生活場景'}」的生活情境裡` },
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
      prompt: buildFillPrompt(f.theme, ta),
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
      `\n\n【調性呼應】規格表的標題或分隔線可用「${ta}」調性做點綴，但底維持白底、數字維持黑字清楚可讀。`,
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

  return { cards, optionCards, tone: ta }
}
