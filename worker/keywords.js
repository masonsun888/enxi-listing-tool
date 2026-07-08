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
