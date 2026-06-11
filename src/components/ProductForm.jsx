import { useState } from 'react'
import { BRANDS, MATERIALS, LOCKNLOCK_BRAND } from '../prompts.js'

const labelCls = 'mb-1 block text-base font-bold text-slate-700'
const inputCls =
  'w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-lg text-slate-800 focus:border-teal-500 focus:outline-none'

// 最上面固定的「商品基本資料」區塊，三個分頁共用同一份資料。
export default function ProductForm({ product, setProduct }) {
  const [colorDraft, setColorDraft] = useState('')

  function update(field, value) {
    setProduct((p) => ({ ...p, [field]: value }))
  }

  // 選樂扣時品名預設帶入「樂扣」；從樂扣切走且品名仍只是「樂扣」時清空，避免殘留。
  function updateBrand(value) {
    setProduct((p) => {
      let name = p.name
      if (value === LOCKNLOCK_BRAND && name.trim() === '') name = LOCKNLOCK_BRAND
      else if (p.brand === LOCKNLOCK_BRAND && value !== LOCKNLOCK_BRAND && name.trim() === LOCKNLOCK_BRAND)
        name = ''
      return { ...p, brand: value, name }
    })
  }

  function addColor() {
    const c = colorDraft.trim()
    if (!c) return
    if (product.colors.includes(c)) {
      setColorDraft('')
      return
    }
    setProduct((p) => ({ ...p, colors: [...p.colors, c] }))
    setColorDraft('')
  }

  function removeColor(color) {
    setProduct((p) => ({ ...p, colors: p.colors.filter((c) => c !== color) }))
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-bold text-slate-800">📦 商品基本資料</h2>

      <div className="space-y-4">
        <div>
          <label className={labelCls}>品牌</label>
          <select
            value={product.brand}
            onChange={(e) => updateBrand(e.target.value)}
            className={inputCls}
          >
            {BRANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>品名</label>
          <input
            type="text"
            value={product.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="例：316不鏽鋼保溫杯"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>容量/尺寸</label>
          <input
            type="text"
            value={product.size}
            onChange={(e) => update('size', e.target.value)}
            placeholder="例：500ml / 20cm"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>材質</label>
          <select
            value={product.material}
            onChange={(e) => update('material', e.target.value)}
            className={inputCls}
          >
            {MATERIALS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>顏色（可新增多個）</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={colorDraft}
              onChange={(e) => setColorDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addColor()
                }
              }}
              placeholder="輸入顏色後按新增"
              className={inputCls}
            />
            <button
              type="button"
              onClick={addColor}
              className="shrink-0 rounded-xl bg-teal-600 px-5 py-3 text-lg font-bold text-white active:scale-95"
            >
              新增
            </button>
          </div>

          {product.colors.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {product.colors.map((color) => (
                <span
                  key={color}
                  className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-4 py-2 text-base font-semibold text-teal-800"
                >
                  {color}
                  <button
                    type="button"
                    onClick={() => removeColor(color)}
                    className="text-teal-500 active:text-teal-700"
                    aria-label={`移除 ${color}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
