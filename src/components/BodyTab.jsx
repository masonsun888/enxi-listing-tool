import ResultBox from './ResultBox.jsx'
import { buildBodyPrompt } from '../prompts.js'

// 分頁2：內文（不需額外輸入，沿用商品基本資料）
export default function BodyTab({ product, work, setWork }) {
  function generate() {
    setWork((w) => ({ ...w, bodyResult: buildBodyPrompt(product) }))
  }

  return (
    <div>
      <p className="text-base text-slate-500">
        直接使用上方的商品基本資料，按下方按鈕產生內文指令。
      </p>

      <button
        type="button"
        onClick={generate}
        className="mt-3 w-full rounded-2xl bg-slate-800 py-5 text-xl font-bold text-white shadow-md active:scale-[0.98]"
      >
        產生內文指令
      </button>

      <ResultBox value={work.bodyResult} rows={12} />
    </div>
  )
}
