import { useState } from 'react'

// 新品九圖的單張工作卡：序號＋圖種名／素材提示（＋存素材圖）／prompt（預設折疊）／複製／文字核對清單／完成勾勾。
// materialImage：{ index, download }，AI 建議的那張素材圖；copiedBefore＋onCopied：持久的「已複製」標記。
export default function NineCard({ card, done, onToggleDone, isHero, materialImage, copiedBefore, onCopied }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [checked, setChecked] = useState({})

  async function copy() {
    try {
      await navigator.clipboard.writeText(card.prompt)
    } catch {
      const el = document.createElement('textarea')
      el.value = card.prompt
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    if (onCopied) onCopied()
  }

  return (
    <div
      className={`rounded-2xl border-2 bg-white p-4 shadow-sm transition ${
        done
          ? 'border-emerald-300 opacity-50'
          : card.tier === 'core'
            ? 'border-rose-300' // 🔥 死磕（Hero／規格）
            : card.tier === 'fill'
              ? 'border-slate-200' // 🌊 放生
              : 'border-amber-300' // ✅ 要對（比較／選項）
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-800">
          <span>
            {typeof card.slot === 'number' ? `${card.slot}｜` : ''}
            {card.label}
          </span>
          {card.tier === 'core' && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-600">🔥 最重要</span>
          )}
          {card.tier === 'fill' && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-400">🌊 充門面</span>
          )}
          {copiedBefore && !done && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">已複製</span>
          )}
        </h3>
        <button
          type="button"
          onClick={onToggleDone}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold active:scale-95 ${
            done ? 'bg-emerald-500 text-white' : 'border-2 border-slate-200 bg-white text-slate-400'
          }`}
        >
          {done ? '✓ 完成' : '完成'}
        </button>
      </div>

      <p className="mt-2 rounded-xl bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">
        📎 這張要給 GPT 的素材：{card.materialsHint}
      </p>

      {card.chainNote && (
        <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600">{card.chainNote}</p>
      )}

      {materialImage && (
        <button
          type="button"
          onClick={materialImage.download}
          className="mt-2 block w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-base font-bold text-slate-600 active:scale-[0.98]"
        >
          ⬇ 存素材圖（第 {materialImage.index + 1} 張），貼 GPT 時附上
        </button>
      )}

      {isHero && (
        <a
          href="/assets/hero-ref-1.png"
          download="hero-ref-1.png"
          className="mt-2 block rounded-xl border-2 border-teal-200 bg-teal-50 px-3 py-2.5 text-center text-base font-bold text-teal-700 active:scale-[0.98]"
        >
          ⬇ 下載標準版型參考圖
        </a>
      )}

      {card.warning && (
        <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600">{card.warning}</p>
      )}

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="mt-2 w-full rounded-xl bg-slate-50 px-3 py-2 text-left text-sm font-bold text-slate-600"
      >
        {expanded ? '▲ 收合指令' : '▼ 展開看指令內容'}
      </button>
      {expanded && (
        <textarea
          readOnly
          rows={10}
          value={card.prompt}
          className="mt-2 w-full resize-none rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-800 focus:outline-none"
        />
      )}

      <button
        type="button"
        onClick={copy}
        className={`mt-3 w-full rounded-2xl py-4 text-xl font-bold text-white shadow-md transition active:scale-[0.98] ${
          copied ? 'bg-emerald-500' : 'bg-teal-600'
        }`}
      >
        {copied ? '✅ 已複製' : '📋 複製'}
      </button>

      {card.textChecklist.length > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3">
          <p className="mb-1 text-sm font-bold text-amber-700">圖生出來後，逐字核對：</p>
          {card.textChecklist.map((item, i) => (
            <label key={i} className="flex items-start gap-2 py-1 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={!!checked[i]}
                onChange={() => setChecked((c) => ({ ...c, [i]: !c[i] }))}
                className="mt-0.5 h-5 w-5 accent-teal-600"
              />
              <span className={checked[i] ? 'line-through opacity-50' : ''}>{item}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
