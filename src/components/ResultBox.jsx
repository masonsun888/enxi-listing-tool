import { useState } from 'react'

// 唯讀文字框 + 下方一顆大大的「複製」按鈕。
export default function ResultBox({ value, rows = 10 }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // 某些舊瀏覽器 / 非 https 環境 fallback
      const el = document.createElement('textarea')
      el.value = value
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="mt-4">
      <textarea
        readOnly
        rows={rows}
        value={value}
        placeholder="按上方按鈕後，指令會出現在這裡⋯⋯"
        className="w-full resize-none rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-base leading-relaxed text-slate-800 focus:outline-none"
      />
      <button
        type="button"
        onClick={handleCopy}
        disabled={!value}
        className={`mt-3 w-full rounded-2xl py-5 text-xl font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-40 ${
          copied ? 'bg-emerald-500' : 'bg-teal-600'
        }`}
      >
        {copied ? '✓ 已複製！' : '📋 複製'}
      </button>
    </div>
  )
}
