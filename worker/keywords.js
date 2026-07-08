// 優化舊品·卡1 的關鍵字內部工具（純函式，無端點）。
// PR-A-fix：萃取／選字下沉為 /api/copy optimize-title 的內部步驟；這裡只留可單元測試的規則邏輯，
// 用來「重新驗證 AI 的選字依據」——不信任 AI 自報的計次，後端自己用競品原文重算。

// 品牌黑名單（命中即從候選與產出剔除，記入 rationale.excluded）。
// ＊自家代理品牌若要經營，由 Mason 從這清單移除。英文品牌大小寫不敏感。
export const BRAND_BLACKLIST = [
  '膳魔師',
  '象印',
  '虎牌',
  '星巴克',
  'THERMOS',
  'ZOJIRUSHI',
  'TIGER',
  '牛頭牌',
  '康寧',
  '樂扣樂扣',
]

// 把 competitorTitles 正規化成「非空字串陣列」（相容陣列或整段換行文字）。
export function normalizeTitles(input) {
  const arr = Array.isArray(input) ? input : typeof input === 'string' ? input.split('\n') : []
  return arr.map((t) => String(t || '').trim()).filter(Boolean)
}

// 文字裡命中的品牌黑名單詞（大小寫不敏感）。
export function blacklistHits(text) {
  const lower = String(text || '').toLowerCase()
  return BRAND_BLACKLIST.filter((b) => lower.includes(b.toLowerCase()))
}

// 服務承諾詞：只能來自使用者「必埋詞」，AI 不得自行加入標題。
export const SERVICE_HINTS = [
  '現貨',
  '免運',
  '隔日到貨',
  '當日',
  '24H',
  '快速出貨',
  '熱銷',
  '熱賣',
  'SGS',
  '檢驗',
  '認證',
  '贈品',
  '買一送',
  '滿額',
  '免費',
  '特價',
  '限量',
  '促銷',
]

// 純編號/雜訊：競品內部型號、序號（如 0415、A123），對搜尋沒意義。含中文一律不算。
export function isPureCode(kw) {
  const s = String(kw || '').trim()
  if (!s || /[一-鿿]/.test(s)) return false
  if (/^\d{4,}$/.test(s)) return true // 4 位以上純數字（316 這種 3 位規格詞不算）
  if (/^[A-Za-z]{1,4}-?\d{2,}$/.test(s)) return true // 型號 A123 / XY-100
  return false
}

// 排除分類（收窄版）：只硬排除三類——他牌品牌詞／服務承諾詞／純編號雜訊；其餘一律保留進字池。
// 理由寫成「教員工」的句式。exclude=false 代表該保留（即使 AI 想排除，也救回）。
export function classifyExclusion(keyword) {
  const kw = String(keyword || '').trim()
  if (!kw) return { exclude: true, reason: '空白' }
  if (blacklistHits(kw).length) return { exclude: true, reason: '他牌品牌詞，用了會被蝦皮判蹭流量違規' }
  if (SERVICE_HINTS.some((s) => kw.toUpperCase().includes(s.toUpperCase())))
    return { exclude: true, reason: '服務承諾詞，屬實請填進必埋詞' }
  if (isPureCode(kw)) return { exclude: true, reason: '競品內部編號，對搜尋沒意義' }
  return { exclude: false, reason: '' }
}

// 鐵律：關鍵字須逐字出現在任一競品標題原文中。
export function isFromTitles(kw, titles) {
  const clean = normalizeTitles(titles)
  return clean.some((t) => t.includes(kw))
}

// 涵蓋去重：長複合詞優先——若某詞是另一個「更長入選詞」的子字串，剔除它（保留長詞）。
export function coverageDedup(keywords) {
  const uniq = [...new Set((Array.isArray(keywords) ? keywords : []).map((k) => String(k || '').trim()).filter(Boolean))]
  uniq.sort((a, b) => [...b].length - [...a].length) // 長 → 短
  const kept = []
  for (const kw of uniq) {
    if (!kept.some((k) => k !== kw && k.includes(kw))) kept.push(kw)
  }
  return kept
}

// 獨立計次：keyword 出現在幾條標題、且「不是完全被某個更長入選詞包住」。
// 例：入選「陶瓷保溫瓶」後，「保溫瓶」在只出現於「陶瓷保溫瓶」的標題不計入獨立次數。
export function countIndependent(keyword, titles, keptKeywords = []) {
  const kw = String(keyword || '').trim()
  if (!kw) return 0
  const clean = normalizeTitles(titles)
  const longer = keptKeywords.filter((k) => k !== kw && k.includes(kw) && [...k].length > [...kw].length)
  let n = 0
  for (const t of clean) {
    if (!t.includes(kw)) continue
    let stripped = t
    for (const L of longer) stripped = stripped.split(L).join(' ') // 把更長入選詞挖空
    if (stripped.includes(kw)) n++ // 挖空後還有殘留 → 這條算獨立出現
  }
  return n
}
