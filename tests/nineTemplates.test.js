import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNine } from '../src/nineTemplates.js'

// 假分析卡：主配色與備選配色用完全不重疊的 hex，方便斷言「九張全用同一組」。
const MAIN_HEXES = {
  BG1: '#2C1F14',
  BG2: '#4A3421',
  BGS1: '#F5EDE3',
  BGS2: '#EFE3D3',
  FILL: '#FFD700',
  SHADOW: '#3A2A10',
  ACCENT: '#C0392B',
}
const ALT_HEXES = {
  BG1: '#1E3A2F',
  BG2: '#2F5D4A',
  BGS1: '#E8F2EC',
  BGS2: '#DCEAE1',
  FILL: '#FFC93C',
  SHADOW: '#12241C',
  ACCENT: '#E8590C',
}

const analysis = {
  product_analysis: {
    category: '廚房用品',
    product_main_color: { hex: '#D4AF37', name: '金色' },
    secondary_colors: [],
  },
  palette: {
    bg_gradient: [MAIN_HEXES.BG1, MAIN_HEXES.BG2],
    bg_soft: [MAIN_HEXES.BGS1, MAIN_HEXES.BGS2],
    title_fill: MAIN_HEXES.FILL,
    title_fill_gradient: ['#FFE066', '#D4A017'],
    title_shadow: MAIN_HEXES.SHADOW,
    accent: MAIN_HEXES.ACCENT,
    rationale: '金色商品配深咖啡漸層底',
  },
  palette_alt: {
    bg_gradient: [ALT_HEXES.BG1, ALT_HEXES.BG2],
    bg_soft: [ALT_HEXES.BGS1, ALT_HEXES.BGS2],
    title_fill: ALT_HEXES.FILL,
    title_fill_gradient: null,
    title_shadow: ALT_HEXES.SHADOW,
    accent: ALT_HEXES.ACCENT,
    rationale: '墨綠底同樣能襯金色',
  },
  copy: {
    main_title_options: ['金光湯匙｜質感升級', '不鏽鋼勺｜好握好洗', '大湯匙｜一勺到底'],
    sub_title: '一體成型好清洗',
    hero_slogan: '質感爆棚！',
    selling_points: [
      { title: '一體成型', desc: '無縫不卡垢好清洗' },
      { title: '加厚手柄', desc: '好握不滑手' },
      { title: '鏡面拋光', desc: '亮面質感耐刮' },
    ],
    scenes: ['明亮廚房中島', '溫馨家庭餐桌', '露營野餐桌'],
    before_after: {
      before_scene: '舊湯匙接縫卡垢洗不乾淨',
      after_scene: '一體成型沖一下就乾淨',
      before_copy: '縫隙卡垢洗不掉',
      after_copy: '一沖就乾淨',
    },
    target_audience: '重視餐具質感的家庭主婦',
  },
  material_check: [{ index: 0, usable: true, issues: [] }],
  image_picks: { hero: 0, intro: 1, scene: 0, spec: 2, compare: 0, rationale: '第3張白底適合規格圖' },
  spec_hints: { capacity: '500ml', weight: null, diameter: null, height: '20cm', bottom_width: null },
}

const product = { brand: '白牌', name: '金色不鏽鋼湯匙', size: '20cm', material: '不鏽鋼', colors: ['金色', '銀色'] }
const specs = { capacity: '500ml', weight: '280g', diameter: '7cm', height: '20cm', bottomWidth: '6.5cm' }

test('九張卡片齊、slot 與 label 正確', () => {
  const { cards, optionCards } = buildNine(product, specs, analysis, 'main')
  assert.equal(cards.length, 9)
  assert.deepEqual(cards.map((c) => c.slot), [1, 2, 3, 4, 5, 6, 7, 8, 9])
  assert.equal(optionCards.length, 2) // 每個顏色一張
  assert.ok(optionCards[0].prompt.includes('金色'))
  assert.ok(optionCards[1].prompt.includes('銀色'))
  for (const c of cards) {
    assert.ok(c.label && c.materialsHint && typeof c.prompt === 'string' && Array.isArray(c.textChecklist))
  }
})

test('九張 prompt 注入同一組主配色 hex，且不含備選配色', () => {
  const { cards } = buildNine(product, specs, analysis, 'main')
  const all = cards.map((c) => c.prompt).join('\n')
  // Hero：背景漸層、填色、陰影、強調色、金屬漸層
  const hero = cards[0].prompt
  for (const hex of [MAIN_HEXES.BG1, MAIN_HEXES.BG2, MAIN_HEXES.FILL, MAIN_HEXES.SHADOW, MAIN_HEXES.ACCENT, '#FFE066', '#D4A017']) {
    assert.ok(hero.includes(hex), `hero 應包含 ${hex}`)
  }
  // 介紹圖：bg_soft 與 FILL/SHADOW
  for (const i of [1, 2, 3]) {
    for (const hex of [MAIN_HEXES.BGS1, MAIN_HEXES.BGS2, MAIN_HEXES.FILL, MAIN_HEXES.SHADOW]) {
      assert.ok(cards[i].prompt.includes(hex), `介紹圖${i} 應包含 ${hex}`)
    }
  }
  // 規格圖：ACCENT 呼應
  assert.ok(cards[7].prompt.includes(MAIN_HEXES.ACCENT))
  // 比較圖：BG1 + ACCENT
  assert.ok(cards[8].prompt.includes(MAIN_HEXES.BG1))
  assert.ok(cards[8].prompt.includes(MAIN_HEXES.ACCENT))
  // 備選配色的 hex 一個都不准出現
  for (const hex of Object.values(ALT_HEXES)) {
    assert.ok(!all.includes(hex), `主配色模式不應出現備選 hex ${hex}`)
  }
})

test('切換備選配色：九張同步全換、主配色 hex 全消失', () => {
  const { cards } = buildNine(product, specs, analysis, 'alt')
  const all = cards.map((c) => c.prompt).join('\n')
  for (const hex of [ALT_HEXES.BG1, ALT_HEXES.BG2, ALT_HEXES.BGS1, ALT_HEXES.BGS2, ALT_HEXES.FILL, ALT_HEXES.SHADOW, ALT_HEXES.ACCENT]) {
    assert.ok(all.includes(hex), `備選模式應包含 ${hex}`)
  }
  for (const hex of Object.values(MAIN_HEXES)) {
    assert.ok(!all.includes(hex), `備選模式不應出現主配色 hex ${hex}`)
  }
  // 備選的 title_fill_gradient 為 null → 不應出現金屬漸層句
  assert.ok(!cards[0].prompt.includes('金屬漸層'))
})

test('規格圖：人填數字原樣出現在 prompt 與核對清單，含硬規則', () => {
  const { cards } = buildNine(product, specs, analysis, 'main')
  const spec = cards[7]
  for (const val of ['500ml', '280g', '7cm', '20cm', '6.5cm', '金色不鏽鋼湯匙']) {
    assert.ok(spec.prompt.includes(val), `規格圖 prompt 應原樣包含 ${val}`)
  }
  assert.ok(spec.prompt.includes('數字與文字必須與我提供的完全一致'))
  assert.deepEqual(spec.textChecklist, [
    '品名：金色不鏽鋼湯匙',
    '容量：500ml',
    '重量：280g',
    '口徑：7cm',
    '高度：20cm',
    '底部寬度：6.5cm',
  ])
  assert.ok(spec.warning.includes('逐字核對'))
})

test('比較圖：含防杜撰硬規則字樣', () => {
  const { cards } = buildNine(product, specs, analysis, 'main')
  const cmp = cards[8].prompt
  assert.ok(cmp.includes('嚴禁出現任何其他品牌'))
  assert.ok(cmp.includes('市售款'))
  assert.ok(cmp.includes('一般款'))
  assert.ok(cmp.includes('嚴禁出現任何數據、百分比'))
  assert.ok(cmp.includes(analysis.copy.before_after.before_copy))
  assert.ok(cmp.includes(analysis.copy.before_after.after_copy))
})

test('主標題：預設取第一個候選並拆雙行；customMainTitle 優先', () => {
  const a = buildNine(product, specs, analysis, 'main')
  assert.ok(a.cards[0].prompt.includes('上行「金光湯匙」'))
  assert.ok(a.cards[0].prompt.includes('下行「質感升級」'))
  assert.ok(a.cards[0].textChecklist.some((t) => t.includes('金光湯匙')))

  const b = buildNine(product, specs, analysis, 'main', '手打湯匙｜職人手感')
  assert.ok(b.cards[0].prompt.includes('上行「手打湯匙」'))
  assert.ok(!b.cards[0].prompt.includes('金光湯匙'))

  const c = buildNine(product, specs, analysis, 'main', '', 2)
  assert.ok(c.cards[0].prompt.includes('上行「大湯匙」'))
})

test('素材分工：各卡片的素材提示帶 AI 建議張數；沒有 image_picks 時退回通用提示', () => {
  const { cards } = buildNine(product, specs, analysis, 'main')
  assert.ok(cards[0].materialsHint.includes('第 1 張')) // hero: 0
  assert.ok(cards[1].materialsHint.includes('第 2 張')) // intro: 1
  assert.ok(cards[4].materialsHint.includes('第 1 張')) // scene: 0
  assert.ok(cards[7].materialsHint.includes('第 3 張')) // spec: 2
  assert.ok(cards[8].materialsHint.includes('第 1 張')) // compare: 0

  // 舊存檔沒有 image_picks → 不炸、提示不含「AI 建議」
  const legacy = JSON.parse(JSON.stringify(analysis))
  delete legacy.image_picks
  const { cards: legacyCards } = buildNine(product, specs, legacy, 'main')
  for (const c of legacyCards) {
    assert.ok(!c.materialsHint.includes('AI 建議'))
  }
})

test('主圖版本：黃/藍/紅只覆蓋第 1 張，內頁八張照用 AI 配色', () => {
  const y = buildNine(product, specs, analysis, 'main', '', 0, 'yellow')
  // 主圖用黃底固定色，不再出現 AI 主配色的背景
  assert.ok(y.cards[0].prompt.includes('#FFD900'))
  assert.ok(y.cards[0].prompt.includes('黃底爆炸款'))
  assert.ok(!y.cards[0].prompt.includes(MAIN_HEXES.BG1))
  // 內頁（介紹圖）仍用 AI 配色
  assert.ok(y.cards[1].prompt.includes(MAIN_HEXES.BGS1))
  assert.ok(y.cards[7].prompt.includes(MAIN_HEXES.ACCENT))

  // 預設 ai 版本＝原本的商品錨定配色
  const a = buildNine(product, specs, analysis, 'main', '', 0, 'ai')
  assert.ok(a.cards[0].prompt.includes(MAIN_HEXES.BG1))
  assert.ok(!a.cards[0].prompt.includes('#FFD900'))

  const r = buildNine(product, specs, analysis, 'main', '', 0, 'red')
  assert.ok(r.cards[0].prompt.includes('紅爆價格款'))
})

test('賣場定位與爆款強度：九張各有定位句，主圖含強度規則', () => {
  const { cards } = buildNine(product, specs, analysis, 'main')
  assert.ok(cards[0].prompt.includes('賣場的第 1 張'))
  assert.ok(cards[1].prompt.includes('賣場的第 2 張'))
  assert.ok(cards[4].prompt.includes('賣場的第 5 張'))
  assert.ok(cards[7].prompt.includes('賣場的第 8 張'))
  assert.ok(cards[8].prompt.includes('賣場的第 9 張'))
  // 爆款強度規則（佬筍 GPT 六要點）
  assert.ok(cards[0].prompt.includes('2.5 倍'))
  assert.ok(cards[0].prompt.includes('20~25%'))
  assert.ok(cards[0].prompt.includes('放射狀光線'))
})

test('情境圖：三張場景與構圖角度皆不同、附禁字警語', () => {
  const { cards } = buildNine(product, specs, analysis, 'main')
  const scenes = cards.slice(4, 7)
  const prompts = scenes.map((c) => c.prompt)
  assert.equal(new Set(prompts).size, 3)
  assert.ok(prompts[0].includes('明亮廚房中島') && prompts[0].includes('中景視角'))
  assert.ok(prompts[1].includes('溫馨家庭餐桌') && prompts[1].includes('近距特寫'))
  assert.ok(prompts[2].includes('露營野餐桌') && prompts[2].includes('俯拍'))
  for (const c of scenes) {
    assert.ok(c.prompt.includes('畫面中不出現任何文字'))
    assert.equal(c.textChecklist.length, 0)
    assert.ok(c.warning.includes('看到字＝重生'))
  }
})
