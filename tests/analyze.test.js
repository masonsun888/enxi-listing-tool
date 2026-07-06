import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateAnalysis,
  parseAnalysisText,
  normalizeAnalysis,
  costTWD,
  monthKey,
} from '../worker/analyze.js'

function makeValidAnalysis() {
  const palette = {
    bg_gradient: ['#2C1F14', '#4A3421'],
    bg_soft: ['#F5EDE3', '#EFE3D3'],
    title_fill: '#FFD700',
    title_fill_gradient: null,
    title_shadow: '#3A2A10',
    accent: '#C0392B',
    rationale: '測試',
  }
  return {
    product_analysis: { category: '廚房用品', product_main_color: { hex: '#D4AF37', name: '金色' }, secondary_colors: [] },
    palette,
    palette_alt: { ...palette, accent: '#E8590C' },
    copy: {
      main_title_options: ['a｜b', 'c｜d', 'e｜f'],
      sub_title: '一句利益點',
      hero_slogan: '超好用！',
      selling_points: [
        { title: 't1', desc: 'd1' },
        { title: 't2', desc: 'd2' },
        { title: 't3', desc: 'd3' },
      ],
      scenes: ['s1', 's2', 's3'],
      before_after: { before_scene: 'b', after_scene: 'a', before_copy: 'bc', after_copy: 'ac' },
      target_audience: '家庭主婦',
    },
    material_check: [{ index: 0, usable: true, issues: [] }],
  }
}

test('合法分析卡通過驗證', () => {
  assert.equal(validateAnalysis(makeValidAnalysis()), true)
})

test('缺欄位視同失敗', () => {
  const cases = [
    (a) => delete a.palette,
    (a) => delete a.palette_alt,
    (a) => (a.palette.bg_gradient = ['#111111']), // 長度必須 2
    (a) => delete a.palette.title_fill,
    (a) => delete a.palette.accent,
    (a) => (a.palette.bg_soft = null),
    (a) => (a.copy.main_title_options = ['只有一個']), // 長度必須 3
    (a) => (a.copy.selling_points = a.copy.selling_points.slice(0, 2)),
    (a) => (a.copy.scenes = []),
    (a) => delete a.copy.before_after,
    (a) => delete a.copy.sub_title,
    (a) => delete a.material_check,
  ]
  for (const mutate of cases) {
    const a = makeValidAnalysis()
    mutate(a)
    assert.equal(validateAnalysis(a), false)
  }
})

test('normalizeAnalysis：新欄位缺漏或格式怪時補 null，不影響驗證通過', () => {
  // AI 完全沒給新欄位 → 補出完整結構，全 null
  const a = normalizeAnalysis(makeValidAnalysis())
  assert.deepEqual(a.image_picks, { hero: null, intro: null, scene: null, spec: null, compare: null, rationale: '' })
  assert.deepEqual(a.spec_hints, { capacity: null, weight: null, diameter: null, height: null, bottom_width: null })

  // 有給但夾雜怪值 → index 超界/非整數變 null，非字串提示變 null
  const b = makeValidAnalysis()
  b.image_picks = { hero: 1, intro: 9, scene: '2', spec: -1, compare: 0, rationale: '第2張最清楚' }
  b.spec_hints = { capacity: '500ml', weight: 280, height: '', bottom_width: null }
  normalizeAnalysis(b)
  assert.deepEqual(b.image_picks, { hero: 1, intro: null, scene: null, spec: null, compare: 0, rationale: '第2張最清楚' })
  assert.deepEqual(b.spec_hints, { capacity: '500ml', weight: null, diameter: null, height: null, bottom_width: null })

  // 新欄位不列入必填：沒有它們 validateAnalysis 照樣通過
  assert.equal(validateAnalysis(makeValidAnalysis()), true)
})

test('costTWD：典型一次分析約 0.6~0.7 元台幣', () => {
  // 8000 input（$1/M）+ 2500 output（$5/M）= $0.0205 USD ≈ NT$0.656（匯率 32）
  const cost = costTWD(8000, 2500)
  assert.ok(cost > 0.5 && cost < 0.8, `實際：${cost}`)
  assert.equal(costTWD(0, 0), 0)
})

test('monthKey：台灣時區年月，跨月邊界正確', () => {
  assert.match(monthKey(), /^\d{4}-\d{2}$/)
  // UTC 7/31 20:00 = 台灣 8/1 04:00 → 應歸入 8 月
  assert.equal(monthKey(Date.UTC(2026, 6, 31, 20, 0, 0)), '2026-08')
  // UTC 7/31 10:00 = 台灣 7/31 18:00 → 仍是 7 月
  assert.equal(monthKey(Date.UTC(2026, 6, 31, 10, 0, 0)), '2026-07')
})

test('parseAnalysisText：可去除 markdown 圍欄', () => {
  const obj = { hello: '世界' }
  assert.deepEqual(parseAnalysisText(JSON.stringify(obj)), obj)
  assert.deepEqual(parseAnalysisText('```json\n' + JSON.stringify(obj) + '\n```'), obj)
  assert.deepEqual(parseAnalysisText('```\n' + JSON.stringify(obj) + '\n```'), obj)
  assert.throws(() => parseAnalysisText('這不是 JSON'))
})
