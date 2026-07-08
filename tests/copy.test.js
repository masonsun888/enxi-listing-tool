import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateCopy,
  buildChecks,
  titleLen,
  FORBIDDEN_WORDS,
  buildTitleChecks,
  sanitizeRationale,
  TITLE_MAX,
  TITLE_MIN,
  MAIN_KW_FRONT,
} from '../worker/copy.js'

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

test('buildTitleChecks（優化標題品檢）：字數 55–60／主字前置／必埋詞／黑名單／禁字／重複', () => {
  assert.equal(TITLE_MAX, 60)
  assert.equal(TITLE_MIN, 55)
  assert.equal(MAIN_KW_FRONT, 10)

  // 字數下限改 55：54 字判太短、55 字剛好過
  assert.equal(buildTitleChecks('保'.repeat(54), {}).tooShort, true)
  assert.equal(buildTitleChecks('保'.repeat(55), {}).tooShort, false)

  // 57 字、主字前置、必埋詞齊全、無黑名單/禁字/重複
  const good =
    '保溫杯 316不鏽鋼 大容量 保冷保溫 露營隨行杯 辦公室車用水壺 贈品 送禮 交換禮物首選 通勤野餐水瓶 上班族'
  const ok = buildTitleChecks(good, { main: '保溫杯', mustInclude: ['贈品'] })
  assert.equal(ok.over, false)
  assert.equal(ok.tooShort, false)
  assert.equal(ok.mainFirst, true)
  assert.deepEqual(ok.mustMissing, [])
  assert.deepEqual(ok.blacklistHits, [])
  assert.deepEqual(ok.forbiddenHits, [])
  assert.deepEqual(ok.repeats, [])

  // 太短
  assert.equal(buildTitleChecks('保溫杯 大容量', { main: '保溫杯' }).tooShort, true)

  // 主字不在前 10 字
  assert.equal(
    buildTitleChecks('大容量隨行杯不鏽鋼露營保冷保溫杯', { main: '保溫杯' }).mainFirst,
    false,
  )

  // 缺必埋詞、含品牌黑名單、含禁字、主字重複 3 次
  const bad = buildTitleChecks('膳魔師保溫杯 保溫杯 保溫杯 保證好用', {
    main: '保溫杯',
    mustInclude: ['贈品', 'SGS'],
  })
  assert.deepEqual(bad.mustMissing, ['贈品', 'SGS'])
  assert.ok(bad.blacklistHits.includes('膳魔師'))
  assert.ok(bad.forbiddenHits.includes('保證'))
  assert.ok(bad.repeats.includes('保溫杯')) // 出現 3 次 > 2

  // 沒給主關鍵字 → mainFirst=null（不判定）
  assert.equal(buildTitleChecks('隨便標題', {}).mainFirst, null)
})

test('必埋詞未逐字出現 → 品檢判不過（mustMissing 非空）', () => {
  const title = '保溫杯 316不鏽鋼 大容量 保冷保溫 露營隨行杯 辦公室車用水壺 送禮 交換禮物首選 通勤野餐水瓶 上班族'
  // 標題裡沒有「贈品」「SGS」
  const c = buildTitleChecks(title, { main: '保溫杯', mustInclude: ['贈品', 'SGS'] })
  assert.deepEqual(c.mustMissing, ['贈品', 'SGS'])
})

test('sanitizeRationale：收窄排除——AI 誤排的賣點屬性詞救回 picked，他牌/服務/編號才真排除', () => {
  const competitors = ['捏捏樂製冰桶 脫模神器 省空間 露營', '製冰桶 矽膠 膳魔師 0415 現貨']
  const raw = {
    main: '製冰桶',
    picked: [{ keyword: '製冰桶', type: '品類' }],
    // AI 誤把賣點詞丟進 excluded，且混入他牌/服務/編號
    excluded: [
      { keyword: '脫模神器', reason: '與本品無關' },
      { keyword: '省空間', reason: '與本品無關' },
      { keyword: '膳魔師', reason: '' },
      { keyword: '現貨', reason: '' },
      { keyword: '0415', reason: '' },
    ],
  }
  const r = sanitizeRationale(raw, competitors)
  const pickedWords = r.picked.map((p) => p.keyword)
  const excludedWords = r.excluded.map((e) => e.keyword)
  // 賣點屬性詞被救回
  assert.ok(pickedWords.includes('脫模神器'))
  assert.ok(pickedWords.includes('省空間'))
  // 三類硬排除
  assert.ok(excludedWords.includes('膳魔師'))
  assert.ok(excludedWords.includes('現貨'))
  assert.ok(excludedWords.includes('0415'))
  // 賣點詞不在排除
  assert.ok(!excludedWords.includes('脫模神器'))
})
