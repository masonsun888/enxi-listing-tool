import ResultBox from './ResultBox.jsx'
import { buildTitlePrompt } from '../prompts.js'

// 分頁1：標題
export default function TitleTab({ product, work, setWork }) {
  const set = (k, v) => setWork((w) => ({ ...w, [k]: v }))

  function generate() {
    set('titleResult', buildTitlePrompt(product, work.competitorTitles))
  }

  return (
    <div>
      <label className="mb-1 block text-base font-bold text-slate-700">
        貼上 2-3 個競品標題
      </label>
      <textarea
        rows={4}
        value={work.competitorTitles}
        onChange={(e) => set('competitorTitles', e.target.value)}
        placeholder="一行一個競品標題⋯⋯"
        className="w-full resize-none rounded-xl border-2 border-slate-200 bg-white p-4 text-base text-slate-800 focus:border-teal-500 focus:outline-none"
      />

      <button
        type="button"
        onClick={generate}
        className="mt-3 w-full rounded-2xl bg-slate-800 py-5 text-xl font-bold text-white shadow-md active:scale-[0.98]"
      >
        產生標題指令
      </button>

      <ResultBox value={work.titleResult} rows={14} />
    </div>
  )
}
