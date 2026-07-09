import { useState } from 'react'

// 兩種輸出的顏色語言（讓員工一眼分「這是生圖」還是「這是文字」）：
// image＝紫（貼給 ChatGPT 生圖）｜copy＝青綠（文字內容）。
const KINDS = {
  image: {
    chip: '🎨 生圖指令（貼給 ChatGPT）',
    chipCls: 'bg-violet-100 text-violet-700',
    boxCls: 'border-violet-200 bg-violet-50 text-violet-900',
  },
  copy: {
    chip: '📝 文字內容',
    chipCls: 'bg-teal-100 text-teal-700',
    boxCls: 'border-teal-200 bg-teal-50 text-teal-900',
  },
}

// 唯讀文字框 + 下方一顆大大的「複製」按鈕。kind 決定顏色（image 紫／copy 青綠）。
export default function ResultBox({ value, rows = 10, kind = 'copy' }) {
  const k = KINDS[kind] || KINDS.copy
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
      <span className={`mb-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${k.chipCls}`}>
        {k.chip}
      </span>
      <textarea
        readOnly
        rows={rows}
        value={value}
        placeholder="按上方按鈕後，指令會出現在這裡⋯⋯"
        className={`w-full resize-none rounded-2xl border-2 p-4 text-base leading-relaxed focus:outline-none ${k.boxCls}`}
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
