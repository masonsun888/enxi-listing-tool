import test from 'node:test'
import assert from 'node:assert/strict'
import { validateAnalysis, parseAnalysisText } from '../worker/analyze.js'

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

test('parseAnalysisText：可去除 markdown 圍欄', () => {
  const obj = { hello: '世界' }
  assert.deepEqual(parseAnalysisText(JSON.stringify(obj)), obj)
  assert.deepEqual(parseAnalysisText('```json\n' + JSON.stringify(obj) + '\n```'), obj)
  assert.deepEqual(parseAnalysisText('```\n' + JSON.stringify(obj) + '\n```'), obj)
  assert.throws(() => parseAnalysisText('這不是 JSON'))
})
