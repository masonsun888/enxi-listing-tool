import { useState } from 'react'
import { PEARL_BRAND, LOCKNLOCK_BRAND } from '../prompts.js'

// 分頁4：定價試算（依品牌套不同公式）
// 樂扣樂扣：成本 × 1.21（或對齊酷澎價）
// 珍珠金屬：亞馬遜日幣價 × 0.19 × 1.31
// 白牌/其他：成本 ÷ 0.49，使 (售價×0.79 − 成本) ÷ 售價 ≥ 30%
export default function PriceTab({ product }) {
  const [input, setInput] = useState('')
  const brand = product.brand
  const isPearl = brand === PEARL_BRAND
  const isLock = brand === LOCKNLOCK_BRAND

  const n = parseFloat(input)
  const valid = !Number.isNaN(n) && n > 0

  const cfg = isPearl
    ? { label: '亞馬遜日幣價格（¥）', placeholder: '例：1500' }
    : { label: '銷售成本（台幣）', placeholder: '例：100' }

  let result = null
  if (valid) {
    if (isLock) {
      const raw = n * 1.21
      result = {
        price: Math.ceil(raw),
        rows: [['公式', '成本 × 1.21'], ['計算', `${n} × 1.21 = ${raw.toFixed(1)}`]],
        note: '※ 或直接對齊酷澎（Coupang）實際售價，取較合適者。',
      }
    } else if (isPearl) {
      const twCost = n * 0.19
      const raw = twCost * 1.31
      result = {
        price: Math.ceil(raw),
        rows: [
          ['公式', '日幣價 × 0.19 × 1.31'],
          ['日幣→台幣成本', `${n} × 0.19 = ${twCost.toFixed(1)} 元`],
          ['加價', `${twCost.toFixed(1)} × 1.31 = ${raw.toFixed(1)}`],
        ],
        note: '※ 0.19 為日幣匯率、1.31 為加價係數。',
      }
    } else {
      const raw = n / 0.49
      const price = Math.ceil(raw)
      const margin = ((price * 0.79 - n) / price) * 100
      result = {
        price,
        rows: [['公式', '成本 ÷ 0.49'], ['計算', `${n} ÷ 0.49 = ${raw.toFixed(1)}`]],
        note: `※ 此售價毛利率約 ${margin.toFixed(1)}%（(售價×0.79 − 成本) ÷ 售價 ≥ 30%）。`,
      }
    }
  }

  return (
    <div>
      <div className="rounded-xl bg-slate-50 px-4 py-3 text-base font-semibold text-slate-600">
        目前品牌：<span className="text-teal-700">{brand}</span>
        <span className="ml-1 text-sm text-slate-400">
          {isLock ? '（成本×1.21）' : isPearl ? '（日幣×0.19×1.31）' : '（毛利 ≥ 30%）'}
        </span>
      </div>

      <label className="mb-1 mt-4 block text-base font-bold text-slate-700">{cfg.label}</label>
      <input
        type="number"
        inputMode="decimal"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={cfg.placeholder}
        className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-xl text-slate-800 focus:border-teal-500 focus:outline-none"
      />

      {valid && result && (
        <div className="mt-4 rounded-2xl border-2 border-teal-200 bg-teal-50 p-5 text-center">
          <p className="text-base font-semibold text-teal-700">建議售價</p>
          <p className="my-1 text-5xl font-extrabold text-teal-700">${result.price}</p>
          <div className="mx-auto mt-3 max-w-[300px] space-y-1 text-left">
            {result.rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 text-sm text-slate-600">
                <span className="shrink-0 font-semibold">{k}</span>
                <span className="text-right">{v}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">{result.note}</p>
        </div>
      )}

      {!valid && (
        <p className="mt-4 text-center text-sm text-slate-400">
          輸入數字後自動試算建議售價。
        </p>
      )}
    </div>
  )
}
