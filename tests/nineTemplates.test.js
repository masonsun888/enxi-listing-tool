import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNine, deriveTone, TONE_OPTIONS } from '../src/nineTemplates.js'

const analysis = {
  product_analysis: { category: '廚房用品', product_main_color: { hex: '#D4AF37', name: '金色' }, secondary_colors: [] },
  // palette 仍可能存在，但 v2/v3 模板都不吃它了
  palette: { bg_gradient: ['#2C1F14', '#4A3421'], bg_soft: ['#F5EDE3', '#EFE3D3'], title_fill: '#FFD700', title_fill_gradient: null, title_shadow: '#3A2A10', accent: '#C0392B', rationale: 'x' },
  palette_alt: { bg_gradient: ['#1E3A2F', '#2F5D4A'], bg_soft: ['#E8F2EC', '#DCEAE1'], title_fill: '#FFC93C', title_fill_gradient: null, title_shadow: '#12241C', accent: '#E8590C', rationale: 'y' },
  copy: {
    main_title_options: ['捏捏冰盒｜輕鬆出冰', '解壓冰格｜一捏就掉', '矽膠冰盒｜省力脫模'],
    sub_title: '輕壓側面自動脫模',
    hero_slogan: '✔ 秒脫模',
    selling_points: [
      { title: '一捏脫模', desc: '不用敲不用打' },
      { title: '食品級矽膠', desc: '軟軟好清洗' },
      { title: '大小雙規格', desc: '60格/40格' },
    ],
    scenes: ['明亮廚房中島', '冰箱收納格', '調酒吧台'],
    before_after: { before_scene: '傳統硬冰盒敲半天', after_scene: '軟矽膠一捏就掉', before_copy: '敲到手痛', after_copy: '一捏就出冰' },
    target_audience: '愛做手搖飲的女性',
    key_action_options: ['手擠壓、冰塊掉進玻璃杯', '倒扣脫模、冰塊落進杯裡', '捏一捏的療癒感'],
  },
  material_check: [{ index: 0, usable: true, issues: [] }],
  image_picks: { hero: 0, intro: 1, scene: 0, spec: 2, compare: 0, rationale: 'x' },
  spec_hints: { capacity: null, weight: null, diameter: null, height: null, bottom_width: null },
}

const product = { brand: '白牌', name: '解壓捏捏樂製冰格', size: '', material: '矽膠', colors: ['薄荷綠', '奶油白'] }
const specs = { capacity: '60格', weight: '133g', diameter: '9cm', height: '8cm', bottomWidth: '8.5cm' }

const HEX = /#[0-9a-fA-F]{6}/

test('八張卡＋選項圖：slot、檔次正確', () => {
  const { cards, optionCards } = buildNine(product, specs, analysis)
  assert.equal(cards.length, 8)
  assert.deepEqual(cards.map((c) => c.slot), [1, 2, 3, 4, 5, 6, 7, 8])
  assert.equal(cards[0].tier, 'core') // Hero
  assert.equal(cards[7].tier, 'core') // 規格
  assert.equal(cards[6].tier, 'ok') // 比較
  assert.ok([2, 3, 4, 5, 6].every((n) => cards[n - 1].tier === 'fill')) // 放生區
  assert.equal(optionCards.length, 2)
  assert.ok(optionCards[0].prompt.includes('薄荷綠'))
  assert.ok(optionCards.every((c) => c.tier === 'ok'))
})

test('Hero 是五句濃縮：不含 hex、整段 ≤12 行、不含畫面原則/質感錨點', () => {
  const { cards } = buildNine(product, specs, analysis)
  const hero = cards[0].prompt
  assert.ok(!HEX.test(hero), 'Hero 不應含任何 hex 色碼')
  // 整段 prompt ≤ 12 行（含空行）——克制才出質感
  assert.ok(hero.split('\n').length <= 12, `Hero 應 ≤12 行，實際 ${hero.split('\n').length} 行`)
  // v2 的稀釋段落全部砍掉
  assert.ok(!hero.includes('畫面原則'), 'v3 Hero 不該再有「畫面原則」')
  assert.ok(!hero.includes('質感錨點'), 'v3 Hero 不該再有「質感錨點」')
  assert.ok(!hero.includes('你的判斷會比我準'), 'v2 的自由發揮長句已刪')
  assert.ok(!hero.includes('4K'), 'v2 的輸出長串已刪')
  // 五句該有的內容
  assert.ok(hero.includes('主要賣點是「一捏脫模」'))
  assert.ok(hero.includes('，食品級矽膠 是次要'), '應帶出主次關係')
  assert.ok(hero.includes('手擠壓、冰塊掉進玻璃杯'), '關鍵動作帶落點')
  assert.ok(hero.includes('主標題「捏捏冰盒／輕鬆出冰」'), '主標雙行以／接、精簡')
  assert.ok(hero.includes('版型參考圖'))
  assert.ok(hero.includes('正方形 1:1'))
  assert.ok(hero.includes('配色背景以 女性、粉嫩療癒 為主'), 'TA 調性錨用白話句型')
})

test('連貫錨：八張都含同一句 tone，且整體不注入 hex', () => {
  const { cards, tone } = buildNine(product, specs, analysis)
  assert.ok(tone && tone.length > 0)
  for (const c of cards) {
    assert.ok(c.prompt.includes(tone), `${c.label} 應含調性錨「${tone}」`)
  }
  const all = cards.map((c) => c.prompt).join('\n')
  // 規格數字是人填的，允許出現；但配色 hex 一律不該出現
  assert.ok(!HEX.test(all), '任何一張都不該注入 hex')
})

test('比較圖鬆綁：允許跟傳統款對比、禁指名品牌、禁數據；不再全禁一般款', () => {
  const cmp = buildNine(product, specs, analysis).cards[6].prompt
  assert.ok(cmp.includes('傳統／一般款'))
  assert.ok(cmp.includes('嚴禁指名道姓打任何「特定品牌」'))
  assert.ok(cmp.includes('嚴禁捏造任何數據'))
  // 舊版「嚴禁出現任何其他品牌…市售款…一般款」的全禁字樣不該再有
  assert.ok(!cmp.includes('嚴禁出現任何其他品牌'))
})

test('規格圖：人填數字原樣、不含 hex、含硬規則與調性呼應', () => {
  const spec = buildNine(product, specs, analysis).cards[7].prompt
  for (const val of ['60格', '133g', '9cm', '8cm', '8.5cm', '解壓捏捏樂製冰格']) {
    assert.ok(spec.includes(val), `規格圖應原樣含 ${val}`)
  }
  assert.ok(spec.includes('數字與文字必須與我提供的完全一致'))
  assert.ok(spec.includes('調性呼應'))
  assert.ok(!HEX.test(spec))
})

test('放生區：prompt 明顯比 Hero 短、只鎖主題＋調性，含 chainNote、無 textChecklist', () => {
  const { cards, tone } = buildNine(product, specs, analysis)
  const hero = cards[0].prompt
  for (const i of [1, 2, 3, 4, 5]) {
    assert.ok(cards[i].prompt.includes(tone))
    assert.ok(cards[i].prompt.includes('你自由發揮'))
    assert.ok(cards[i].chainNote && cards[i].chainNote.includes('連貫關鍵'))
    assert.equal(cards[i].textChecklist.length, 0, '放生區不放 textChecklist')
  }
  // Hero 與規格圖不需要連貫鏈提醒
  assert.ok(!cards[0].chainNote)
  assert.ok(!cards[7].chainNote)
})

test('choices：換主賣點／自填主標／換關鍵動作／覆蓋調性／關掉次要', () => {
  const a = buildNine(product, specs, analysis, { sellingPointPick: 1 })
  assert.ok(a.cards[0].prompt.includes('主要賣點是「食品級矽膠」'))

  const b = buildNine(product, specs, analysis, { customMainTitle: '手打主標｜厲害' })
  assert.ok(b.cards[0].prompt.includes('主標題「手打主標／厲害」'))
  assert.ok(!b.cards[0].prompt.includes('捏捏冰盒'))

  const c = buildNine(product, specs, analysis, { keyActionPick: 1 })
  assert.ok(c.cards[0].prompt.includes('倒扣脫模、冰塊落進杯裡'))

  const d = buildNine(product, specs, analysis, { customKeyAction: '單手一壓' })
  assert.ok(d.cards[0].prompt.includes('單手一壓'))

  const e = buildNine(product, specs, analysis, { toneOverride: '男性、俐落質感深色調' })
  assert.equal(e.tone, '男性、俐落質感深色調')
  assert.ok(e.cards[0].prompt.includes('男性、俐落質感深色調'))

  // 關掉次要賣點 → 不補「是次要」
  const f = buildNine(product, specs, analysis, { noSecondary: true })
  assert.ok(!f.cards[0].prompt.includes('是次要'))
})

test('deriveTone：品類＋性別推導短白話錨，有 fallback', () => {
  assert.equal(deriveTone('女性', '廚房用品'), '女性、粉嫩療癒')
  assert.equal(deriveTone('男性', '3C 配件'), '男性、俐落質感深色調')
  assert.equal(deriveTone('通用', '清潔用品'), '通用、乾淨明亮生活感')
  assert.equal(deriveTone('通用', '不明品類'), '乾淨有質感的電商風')
  assert.ok(TONE_OPTIONS.length >= 4)
})

test('TA 由女性客群自動推出粉嫩調性（預設）', () => {
  // target_audience 含「女性」→ 廚房用品 → 女性、粉嫩療癒
  const { tone } = buildNine(product, specs, analysis)
  assert.equal(tone, '女性、粉嫩療癒')
})

test('舊存檔相容：沒有 key_action_options / choices 也不炸', () => {
  const legacy = JSON.parse(JSON.stringify(analysis))
  delete legacy.copy.key_action_options
  const { cards } = buildNine(product, specs, legacy)
  assert.equal(cards.length, 8)
  assert.ok(cards[0].prompt.includes('呈現最能體現主賣點的使用瞬間')) // 關鍵動作 fallback
})
