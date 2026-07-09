import { useState } from 'react'

// 💡 提示詞新發現：員工做圖/文案時試出「哪句自訂提示詞特別有效」就記一筆，跟著商品存。
// 之後從「已存商品」的「匯出優化報告」把所有商品的發現匯出成 .md，當老闆的優化依據。
const KINDS = ['圖', '文案']

export default function DiscoveryCard({ work, setWork }) {
  const list = work.discoveries || []
  const [kind, setKind] = useState('圖')
  const [text, setText] = useState('')

  function add() {
    const t = text.trim()
    if (!t) return
    const entry = { kind, text: t, at: Date.now() }
    setWork((w) => ({ ...w, discoveries: [entry, ...(w.discoveries || [])] }))
    setText('')
  }
  function remove(at) {
    setWork((w) => ({ ...w, discoveries: (w.discoveries || []).filter((d) => d.at !== at) }))
  }

  return (
    <section className="rounded-2xl border-2 border-amber-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold text-slate-800">💡 提示詞新發現</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        做圖/文案時試出「哪句自訂提示詞特別有效」就記一筆，跟著這個商品存；之後可一鍵匯出成優化報告。
      </p>

      <div className="mt-3 flex gap-2">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold active:scale-95 ${
              kind === k ? 'bg-amber-500 text-white' : 'border-2 border-slate-200 bg-white text-slate-500'
            }`}
          >
            {k === '圖' ? '🖼 圖' : '📝 文案'}
          </button>
        ))}
      </div>

      <textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='例：主圖加「手部特寫、淺景深」質感明顯變好；文案開頭用問句點閱率高'
        className="mt-2 w-full resize-none rounded-xl border-2 border-slate-200 bg-white p-3 text-base text-slate-800 focus:border-amber-400 focus:outline-none"
      />
      <button
        type="button"
        onClick={add}
        disabled={!text.trim()}
        className="mt-2 w-full rounded-xl bg-amber-500 py-2.5 text-base font-bold text-white active:scale-[0.98] disabled:opacity-40"
      >
        ＋ 記一筆發現
      </button>

      {list.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {list.map((d) => (
            <div key={d.at} className="flex items-start justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2">
              <p className="text-sm text-slate-700">
                <span className="mr-1 font-bold text-amber-700">[{d.kind}]</span>
                {d.text}
              </p>
              <button
                type="button"
                onClick={() => remove(d.at)}
                className="shrink-0 text-sm font-bold text-slate-400 active:text-slate-700"
                aria-label="刪除這筆"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
