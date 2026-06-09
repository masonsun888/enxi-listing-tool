import { useState } from 'react'
import ResultBox from './ResultBox.jsx'
import { IMAGE_TYPES, buildImagePrompt, buildSpecLabel } from '../prompts.js'

// 分頁3：製圖
export default function ImageTab({ product }) {
  const [type, setType] = useState('main')
  const [result, setResult] = useState('')

  const isSpec = type === 'spec'

  function generate() {
    if (type === 'spec') {
      setResult(buildSpecLabel(product))
    } else {
      setResult(buildImagePrompt(type, product))
    }
  }

  function selectType(key) {
    setType(key)
    setResult('')
  }

  return (
    <div>
      <label className="mb-2 block text-base font-bold text-slate-700">選擇圖種</label>
      <div className="grid grid-cols-2 gap-3">
        {IMAGE_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => selectType(t.key)}
            className={`rounded-2xl py-6 text-xl font-bold shadow-sm transition active:scale-[0.97] ${
              type === t.key
                ? 'bg-teal-600 text-white'
                : 'bg-white text-slate-700 border-2 border-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isSpec && (
        <div className="mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-base font-semibold text-amber-800">
          ⚠️ 規格圖請用固定排版模板套版，不要用 AI 生成，避免中文字寫錯。
          <br />
          下方是整理好的容量/尺寸/材質文字標籤，複製後拿去套版。
        </div>
      )}

      <button
        type="button"
        onClick={generate}
        className="mt-4 w-full rounded-2xl bg-slate-800 py-5 text-xl font-bold text-white shadow-md active:scale-[0.98]"
      >
        {isSpec ? '產生規格文字標籤' : '產生製圖指令'}
      </button>

      <ResultBox value={result} rows={isSpec ? 5 : 8} />
    </div>
  )
}
