import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeTitles,
  blacklistHits,
  coverageDedup,
  countIndependent,
  isFromTitles,
  BRAND_BLACKLIST,
} from '../worker/keywords.js'

test('normalizeTitles：陣列或整段換行都轉成非空字串陣列', () => {
  assert.deepEqual(normalizeTitles(['a', ' b ', '', '  ']), ['a', 'b'])
  assert.deepEqual(normalizeTitles('a\n b \n\n c'), ['a', 'b', 'c'])
  assert.deepEqual(normalizeTitles(null), [])
})

test('blacklistHits：命中品牌黑名單（英文大小寫不敏感）', () => {
  assert.deepEqual(blacklistHits('316不鏽鋼保溫杯 大容量'), [])
  assert.deepEqual(blacklistHits('膳魔師同款保溫杯'), ['膳魔師'])
  assert.deepEqual(blacklistHits('thermos style bottle'), ['THERMOS'])
  assert.ok(BRAND_BLACKLIST.includes('象印'))
})

test('coverageDedup：長複合詞優先，子字串被涵蓋就剔除', () => {
  assert.deepEqual(coverageDedup(['陶瓷保溫瓶', '保溫瓶', '保溫', '大容量']), ['陶瓷保溫瓶', '大容量'])
  // 去重＋空白過濾
  assert.deepEqual(coverageDedup(['保溫杯', '保溫杯', ' ']), ['保溫杯'])
})

test('countIndependent：獨立計次排除被更長入選詞涵蓋的出現', () => {
  const titles = ['陶瓷保溫瓶 大容量', '陶瓷保溫瓶 露營', '保溫瓶 車用']
  const kept = ['陶瓷保溫瓶', '保溫瓶']
  // 「陶瓷保溫瓶」出現在第 0、1 條
  assert.equal(countIndependent('陶瓷保溫瓶', titles, kept), 2)
  // 「保溫瓶」只有第 2 條是「獨立」出現（第 0、1 條被陶瓷保溫瓶涵蓋）
  assert.equal(countIndependent('保溫瓶', titles, kept), 1)
})

test('isFromTitles：substring 鐵律', () => {
  const titles = ['316不鏽鋼保溫杯', '大容量露營杯']
  assert.equal(isFromTitles('保溫杯', titles), true)
  assert.equal(isFromTitles('露營', titles), true)
  assert.equal(isFromTitles('陶瓷', titles), false)
})
