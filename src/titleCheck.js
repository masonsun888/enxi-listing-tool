// 前端即時品檢：與 worker/copy.js + worker/keywords.js 同一套規則的鏡像（值需同步）。
// 用途：員工直接編輯候選標題時，即時算品檢，不用再打後端。

export const TITLE_MAX = 60
export const TITLE_MIN = 50
export const MAIN_KW_FRONT = 10

// 與 worker/copy.js FORBIDDEN_WORDS 同步
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

// 與 worker/keywords.js BRAND_BLACKLIST 同步
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

export function titleLen(s) {
  return [...String(s || '')].length
}

function startsWithin(title, kw, n) {
  const arr = [...String(title)]
  const lim = Math.min(n, arr.length)
  for (let i = 0; i < lim; i++) {
    if (arr.slice(i).join('').startsWith(kw)) return true
  }
  return false
}

function occurrences(t, kw) {
  if (!kw) return 0
  return t.split(kw).length - 1
}

export function blacklistHits(text) {
  const lower = String(text || '').toLowerCase()
  return BRAND_BLACKLIST.filter((b) => lower.includes(b.toLowerCase()))
}

export function checkTitle(title, { main = '', mustInclude = [] } = {}) {
  const t = String(title || '')
  const m = String(main || '').trim()
  const must = (Array.isArray(mustInclude) ? mustInclude : []).map((s) => String(s || '').trim()).filter(Boolean)
  const len = titleLen(t)
  return {
    len,
    tooShort: len < TITLE_MIN,
    over: len > TITLE_MAX,
    mainFirst: m ? startsWithin(t, m, MAIN_KW_FRONT) : null,
    mustMissing: must.filter((k) => !t.includes(k)),
    blacklistHits: blacklistHits(t),
    forbiddenHits: FORBIDDEN_WORDS.filter((w) => t.includes(w)),
    repeats: [m, ...must].filter((k) => k && occurrences(t, k) > 2),
  }
}

// 品檢 → 給 UI 用的「一句怎麼修」列表（全過回空陣列）。
export function checkMessages(c) {
  if (!c) return []
  const msgs = []
  if (c.over) msgs.push(`超過 ${TITLE_MAX} 字（目前 ${c.len}），刪短一點`)
  if (c.tooShort) msgs.push(`只有 ${c.len} 字，塞到 ${TITLE_MIN}–${TITLE_MAX} 字才吃得到搜尋`)
  if (c.mainFirst === false) msgs.push('主關鍵字不在前面，往前移到開頭')
  if (c.mustMissing && c.mustMissing.length) msgs.push(`缺必埋詞：${c.mustMissing.join('、')}`)
  if (c.blacklistHits && c.blacklistHits.length) msgs.push(`有他牌詞：${c.blacklistHits.join('、')}，刪掉`)
  if (c.forbiddenHits && c.forbiddenHits.length) msgs.push(`有禁字：${c.forbiddenHits.join('、')}，刪掉`)
  if (c.repeats && c.repeats.length) msgs.push(`「${c.repeats.join('、')}」重複太多次`)
  return msgs
}
