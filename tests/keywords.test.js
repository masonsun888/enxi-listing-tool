import test from 'node:test'
import assert from 'node:assert/strict'
import { rankKeywords, sanitizeSuggested, normalizeTitles } from '../worker/keywords.js'

const titles = [
  '316不鏽鋼保溫杯 大容量 保冷保溫 隨行杯',
  '保溫杯 316不鏽鋼 辦公室 車用',
  '大容量保溫杯 不鏽鋼 露營保冷',
]

test('normalizeTitles：陣列或整段換行都轉成非空字串陣列', () => {
  assert.deepEqual(normalizeTitles(['a', ' b ', '', '  ']), ['a', 'b'])
  assert.deepEqual(normalizeTitles('a\n b \n\n c'), ['a', 'b', 'c'])
  assert.deepEqual(normalizeTitles(null), [])
})

test('rankKeywords：鐵律 substring 過濾＋count/sources＋降冪排序', () => {
  const ranked = rankKeywords(['保溫杯', '316不鏽鋼', '大容量', '保冷', 'AI亂編的詞', '杯'], titles)
  const map = Object.fromEntries(ranked.map((r) => [r.keyword, r]))
  // 「保溫杯」出現在全部 3 條
  assert.equal(map['保溫杯'].count, 3)
  assert.deepEqual(map['保溫杯'].sources, [0, 1, 2])
  // 「316不鏽鋼」出現在第 0、1 條
  assert.equal(map['316不鏽鋼'].count, 2)
  assert.deepEqual(map['316不鏽鋼'].sources, [0, 1])
  // 原文沒有的詞被剔除（鐵律）
  assert.ok(!('AI亂編的詞' in map))
  // 單字（<2）被剔除
  assert.ok(!('杯' in map))
  // 依 count 降冪
  const counts = ranked.map((r) => r.count)
  assert.deepEqual(counts, [...counts].sort((a, b) => b - a))
})

test('rankKeywords：去重、最多 8 個', () => {
  const ranked = rankKeywords(['保溫杯', '保溫杯', '大容量'], titles)
  assert.equal(ranked.filter((r) => r.keyword === '保溫杯').length, 1)
  assert.ok(ranked.length <= 8)
})

test('sanitizeSuggested：main 無效退回第一名、aux 只留通過驗證且 ≤3', () => {
  const ranked = rankKeywords(['保溫杯', '316不鏽鋼', '大容量', '保冷'], titles)
  // main 有效
  const a = sanitizeSuggested({ main: '316不鏽鋼', aux: ['大容量', '保冷', 'AI亂編', '316不鏽鋼'] }, ranked)
  assert.equal(a.main, '316不鏽鋼')
  assert.ok(!a.aux.includes('AI亂編')) // 沒通過驗證
  assert.ok(!a.aux.includes('316不鏽鋼')) // 不能跟 main 重複
  assert.ok(a.aux.length <= 3)
  // main 無效 → 退回排序第一名
  const b = sanitizeSuggested({ main: '不存在的詞', aux: [] }, ranked)
  assert.equal(b.main, ranked[0].keyword)
})
