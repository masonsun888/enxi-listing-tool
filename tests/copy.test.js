import test from 'node:test'
import assert from 'node:assert/strict'
import { validateCopy, buildChecks, titleLen, FORBIDDEN_WORDS } from '../worker/copy.js'

function makeValidCopy() {
  return {
    shopee_title: '316不鏽鋼湯匙 加厚一體成型 好握好洗 餐具 湯勺',
    golden_intro: '一支好湯匙讓吃飯變享受……（黃金前段）快帶一支回家！',
    pain_points: ['😩 舊湯匙接縫卡垢超噁，這支一體成型沖一下就乾淨'],
    spec_lines: ['材質：不鏽鋼', '長度：20cm'],
    aftersale: [
      '【包裹的小保險｜小湯匙】台灣現貨，出貨前人工檢查。',
      '【拆禮物的小儀式｜小湯匙】請開箱錄影，問題可加速處理。',
      '【關於完美主義｜小湯匙】金屬拋光可能有細微紋路與螢幕色差。',
    ],
    hashtags: ['#湯匙', '#不鏽鋼餐具', '#廚房用品'],
  }
}

test('validateCopy：合法通過、缺欄位失敗', () => {
  assert.equal(validateCopy(makeValidCopy()), true)
  const cases = [
    (c) => delete c.shopee_title,
    (c) => delete c.golden_intro,
    (c) => (c.pain_points = []),
    (c) => (c.aftersale = c.aftersale.slice(0, 2)), // 必須三段
    (c) => (c.hashtags = ['#只有一個', '#兩個']), // 至少 3 個
    (c) => (c.spec_lines = [123]),
  ]
  for (const mutate of cases) {
    const c = makeValidCopy()
    mutate(c)
    assert.equal(validateCopy(c), false)
  }
})

test('titleLen：中文一字一字元、emoji 算一個', () => {
  assert.equal(titleLen('湯匙 spoon'), 8)
  assert.equal(titleLen('🔥湯匙'), 3)
  assert.equal(titleLen(''), 0)
})

test('buildChecks：60 字上限、禁字、公板格式、主關鍵字前置', () => {
  const ok = buildChecks(makeValidCopy(), '316不鏽鋼湯匙')
  assert.equal(ok.titleOver, false)
  assert.deepEqual(ok.forbiddenHits, [])
  assert.equal(ok.aftersaleOk, true)
  assert.equal(ok.keywordFirst, true)

  const bad = makeValidCopy()
  bad.shopee_title = '湯'.repeat(61)
  bad.golden_intro = '全網最低！保證好用！'
  bad.aftersale[0] = '沒有公板格式的一段'
  const checks = buildChecks(bad, '不鏽鋼湯匙')
  assert.equal(checks.titleOver, true)
  assert.equal(checks.titleLen, 61)
  assert.ok(checks.forbiddenHits.includes('全網最低'))
  assert.ok(checks.forbiddenHits.includes('保證'))
  assert.equal(checks.aftersaleOk, false)
  assert.equal(checks.keywordFirst, false)

  // 沒指定主關鍵字 → 不判定
  assert.equal(buildChecks(makeValidCopy(), '').keywordFirst, null)
})

test('FORBIDDEN_WORDS：黑名單存在且都是字串', () => {
  assert.ok(FORBIDDEN_WORDS.length >= 5)
  assert.ok(FORBIDDEN_WORDS.every((w) => typeof w === 'string' && w.length > 0))
})
