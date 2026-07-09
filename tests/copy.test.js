import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateCopy,
  buildChecks,
  titleLen,
  FORBIDDEN_WORDS,
  buildTitleChecks,
  sanitizeRationale,
  enforceTitle,
  finalizeTitles,
  synthesizeTitles,
  buildIntroChecks,
  CANDIDATE_COUNT,
  TITLE_MAX,
  TITLE_MIN,
  MAIN_KW_FRONT,
  INTRO_MAIN_FRONT,
} from '../worker/copy.js'

const POOL = ['大容量', '保冷保溫', '露營隨行杯', '辦公室車用水壺', '交換禮物首選', '通勤野餐水瓶', '上班族', '送禮', '矽膠杯', '派對冰塊盒']

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

  // 塞滿式：<55 字判 titleShort
  const short = makeValidCopy()
  short.shopee_title = '湯匙 不鏽鋼 好用' // 明顯 <55
  assert.equal(buildChecks(short, '湯匙').titleShort, true)
  // 內文前 30 字帶主關鍵字 → introKeywordFront true；沒帶 → false
  const withIntro = makeValidCopy()
  withIntro.golden_intro = '這支不鏽鋼湯匙一體成型好握好洗，吃飯更享受，快帶回家'
  assert.equal(buildChecks(withIntro, '不鏽鋼湯匙').introKeywordFront, true)
  assert.equal(buildChecks(makeValidCopy(), '316不鏽鋼湯匙').introKeywordFront, false)
})

test('buildIntroChecks（內文前100字品檢）：主字前30、禁堆疊、太短、禁字/黑名單', () => {
  assert.equal(INTRO_MAIN_FRONT, 30)
  // 主關鍵字在開頭、鋪關鍵字但不堆疊、夠長
  const good =
    '這款製冰盒真的是廚房小幫手，脫模超輕鬆一壓就掉，冰塊完整不碎裂，省空間好收納，做冰塊、副食品、寶寶粥都好用，食品級矽膠摸起來很安心，家裡用、露營帶著走都方便，實用又療癒的好物真心推薦給你入手一組'
  const c = buildIntroChecks(good, { main: '製冰盒', aux: ['脫模', '省空間'] })
  assert.equal(c.mainFront, true) // 製冰盒在前 30 字
  assert.equal(c.tooShort, false)
  assert.deepEqual(c.stacking, [])
  assert.deepEqual(c.forbiddenHits, [])
  assert.deepEqual(c.blacklistHits, [])

  // 主關鍵字不在前 30 字 → mainFront false
  const late = buildIntroChecks('先講一堆別的東西鋪陳很長很長很長很長很長很長很長很長很長很長之後才出現製冰盒', {
    main: '製冰盒',
    aux: [],
  })
  assert.equal(late.mainFront, false)

  // 堆疊：同一詞前 100 字出現 3 次
  const stack = buildIntroChecks('製冰盒製冰盒製冰盒 好用推薦給你買回家吧', { main: '製冰盒', aux: [] })
  assert.ok(stack.stacking.includes('製冰盒'))
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

test('enforceTitle：<55 就地補字到 55–60、補齊必埋詞', () => {
  const padded = enforceTitle('保溫杯 316不鏽鋼', { main: '保溫杯', mustInclude: ['贈品'], pool: POOL })
  const len = [...padded].length
  assert.ok(len >= TITLE_MIN, `應 ≥${TITLE_MIN}，實際 ${len}`)
  assert.ok(len <= TITLE_MAX, `應 ≤${TITLE_MAX}，實際 ${len}`)
  assert.ok(padded.includes('贈品'), '必埋詞應補進去')
  assert.ok(padded.startsWith('保溫杯'), '主關鍵字仍在最前')
})

test('finalizeTitles：只回全過的、上限 3、湊不滿就減量（絕不含不合格）', () => {
  assert.equal(CANDIDATE_COUNT, 3)
  const opts = { main: '保溫杯', mustInclude: ['贈品'], pool: POOL, count: CANDIDATE_COUNT }
  // 第 1、2 句短 → 補字後合格；第 3 句超 60 → 補不回、必須被丟掉
  const raw = ['保溫杯 316不鏽鋼', '保溫杯 大容量', '保溫杯 ' + '長'.repeat(70)]
  const list = finalizeTitles(raw, opts)
  assert.ok(list.length >= 1 && list.length <= CANDIDATE_COUNT)
  // 每一句都必須全過
  for (const t of list) {
    const c = buildTitleChecks(t, { main: '保溫杯', mustInclude: ['贈品'] })
    assert.equal(c.over, false)
    assert.equal(c.tooShort, false)
    assert.equal(c.mainFirst, true)
    assert.deepEqual(c.mustMissing, [])
    assert.deepEqual(c.blacklistHits, [])
    assert.deepEqual(c.forbiddenHits, [])
  }
  // 超 60 那句不會出現在輸出
  assert.ok(!list.some((t) => t.includes('長長長')))
  // 只有 2 句可救 → 減量成 2（不硬湊第 3 個不合格）
  assert.equal(list.length, 2)
})

test('synthesizeTitles：不夠就用字池合成補滿到 3、全過且不重複', () => {
  const opts = { main: '保溫杯', mustInclude: ['贈品'], pool: POOL, count: CANDIDATE_COUNT }
  // AI 只給 1 句（補字後合格）→ 合成補到 3
  const one = finalizeTitles(['保溫杯 316不鏽鋼'], opts)
  assert.ok(one.length >= 1)
  const list = synthesizeTitles(one, opts)
  assert.equal(list.length, CANDIDATE_COUNT, '應補滿到 3')
  assert.equal(new Set(list).size, list.length, '不可重複')
  for (const t of list) {
    const c = buildTitleChecks(t, { main: '保溫杯', mustInclude: ['贈品'] })
    assert.equal(c.over, false)
    assert.equal(c.tooShort, false)
    assert.equal(c.mainFirst, true)
    assert.deepEqual(c.mustMissing, [])
    assert.deepEqual(c.forbiddenHits, [])
  }
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
