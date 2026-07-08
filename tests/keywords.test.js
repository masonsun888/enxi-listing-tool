import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeTitles,
  blacklistHits,
  coverageDedup,
  countIndependent,
  isFromTitles,
  BRAND_BLACKLIST,
  classifyExclusion,
  isPureCode,
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

test('isPureCode：純編號才算，規格數字與中文詞不算', () => {
  assert.equal(isPureCode('0415'), true) // 4 位純數字
  assert.equal(isPureCode('A123'), true) // 型號
  assert.equal(isPureCode('316'), false) // 3 位規格數字保留
  assert.equal(isPureCode('保溫杯'), false)
  assert.equal(isPureCode('脫模神器'), false)
})

test('classifyExclusion（收窄排除）：只硬排他牌/服務/編號，屬性賣點詞一律保留', () => {
  // 他牌
  assert.equal(classifyExclusion('膳魔師').exclude, true)
  assert.match(classifyExclusion('膳魔師').reason, /他牌/)
  // 服務承諾詞
  assert.equal(classifyExclusion('現貨').exclude, true)
  assert.match(classifyExclusion('免運').reason, /服務承諾/)
  // 純編號
  assert.equal(classifyExclusion('0415').exclude, true)
  assert.match(classifyExclusion('0415').reason, /編號/)
  // 賣點/屬性詞「不得」被排除（收窄的重點）
  assert.equal(classifyExclusion('脫模神器').exclude, false)
  assert.equal(classifyExclusion('省空間').exclude, false)
  assert.equal(classifyExclusion('316不鏽鋼').exclude, false)
})
