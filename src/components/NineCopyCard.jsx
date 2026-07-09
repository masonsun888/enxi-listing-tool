import { useState } from 'react'
import ResultBox from './ResultBox.jsx'

const labelCls = 'mb-1 block text-base font-bold text-slate-700'
const inputCls =
  'w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-lg text-slate-800 focus:border-teal-500 focus:outline-none'

const EMPTY = { mainKeyword: '', competitorTitles: '', result: null, checks: null }

// 把 AI 回的欄位組成一段可直接貼蝦皮商品描述的完整內文。
function assembleBody(r) {
  const parts = [r.golden_intro]
  if (r.pain_points && r.pain_points.length > 0) parts.push(r.pain_points.join('\n\n'))
  if (r.spec_lines && r.spec_lines.length > 0)
    parts.push('【商品規格】\n' + r.spec_lines.map((s) => `・${s}`).join('\n'))
  if (r.aftersale && r.aftersale.length > 0) parts.push(r.aftersale.join('\n\n'))
  if (r.hashtags && r.hashtags.length > 0) parts.push(r.hashtags.join(' '))
  return parts.join('\n\n')
}

function checkWarnings(checks) {
  if (!checks) return []
  const warns = []
  if (checks.titleOver) warns.push(`標題 ${checks.titleLen} 字，超過蝦皮 60 字上限，貼上前要刪短`)
  if (checks.titleShort) warns.push(`標題只有 ${checks.titleLen} 字，塞滿到 55–60 字才吃得到搜尋，建議再按一次`)
  if (checks.forbiddenHits && checks.forbiddenHits.length > 0)
    warns.push(`文案含禁字：${checks.forbiddenHits.join('、')}，請手動刪掉再貼`)
  if (checks.aftersaleOk === false) warns.push('售後三段格式跑掉了，建議再按一次重產')
  if (checks.keywordFirst === false) warns.push('主關鍵字沒有出現在標題最前面，建議再按一次重產')
  if (checks.introKeywordFront === false) warns.push('內文前 30 字沒帶到主關鍵字，建議再按一次重產')
  return warns
}

// 📝 一鍵上架文案：按一顆按鈕 → 後台 AI 直接回「可貼上蝦皮的成品」（標題＋完整內文），
// 不用再複製 prompt 去 GPT。有分析卡會自動吃它的賣點/客群，文案更準；沒有也能用。
export default function NineCopyCard({ product, work, setWork, password, setBudget, overBudget, innerRef }) {
  const state = work.nineCopy || EMPTY
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [titleCopied, setTitleCopied] = useState(false)

  function update(patch) {
    setWork((w) => ({ ...w, nineCopy: { ...(w.nineCopy || EMPTY), ...patch } }))
  }

  const canRun = !!product.name.trim() && !loading && !overBudget

  async function generate() {
    if (!canRun) return
    setError('')
    setLoading(true)
    try {
      const a = work.nine && work.nine.analysis ? work.nine.analysis : null
      const hints = a
        ? {
            category: a.product_analysis && a.product_analysis.category,
            selling_points: a.copy && a.copy.selling_points,
            target_audience: a.copy && a.copy.target_audience,
            scenes: a.copy && a.copy.scenes,
          }
        : null
      const res = await fetch('/api/copy', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(password ? { 'x-app-password': password } : {}),
        },
        body: JSON.stringify({
          product: {
            name: product.name,
            material: product.material,
            colors: product.colors,
            size: product.size,
          },
          mainKeyword: state.mainKeyword,
          competitorTitles: state.competitorTitles,
          hints,
        }),
      })
      if (res.status === 503) throw new Error('後台尚未設定 AI 金鑰')
      if (res.status === 429) {
        const d = await res.json().catch(() => ({}))
        if (d.budget) setBudget(d.budget)
        throw new Error(d.error || '本月 AI 額度已用完')
      }
      if (!res.ok) throw new Error('AI 忙線中，再按一次')
      const data = await res.json()
      if (data.budget) setBudget(data.budget)
      update({ result: data.copy, checks: data.checks })
    } catch (err) {
      setError(String(err && err.message ? err.message : err))
    } finally {
      setLoading(false)
    }
  }

  async function copyTitle() {
    const title = state.result && state.result.shopee_title
    if (!title) return
    try {
      await navigator.clipboard.writeText(title)
    } catch {
      const el = document.createElement('textarea')
      el.value = title
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setTitleCopied(true)
    setTimeout(() => setTitleCopied(false), 1800)
  }

  const r = state.result
  const warns = checkWarnings(state.checks)
  const tLen = r ? [...r.shopee_title].length : 0

  return (
    <section ref={innerRef} className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-slate-800">📝 上架文案（一鍵直接生成）</h2>
      <p className="mb-3 text-sm text-slate-400">
        這個不用貼 GPT——按下去 AI 直接回成品，標題和內文複製了就能貼蝦皮。
      </p>

      <div className="space-y-3">
        <div>
          <label className={labelCls}>主關鍵字（選填）</label>
          <input
            type="text"
            value={state.mainKeyword}
            onChange={(e) => update({ mainKeyword: e.target.value })}
            placeholder="留空 AI 幫你挑，指定了會放標題最前面"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>競品標題（選填，一行一個）</label>
          <textarea
            rows={3}
            value={state.competitorTitles}
            onChange={(e) => update({ competitorTitles: e.target.value })}
            placeholder={'去蝦皮搜同款，把賣得好的標題貼進來\nAI 只會抄「品類關鍵字」，不會抄別人品牌'}
            className="w-full resize-none rounded-xl border-2 border-slate-200 bg-white p-4 text-base text-slate-800 focus:border-teal-500 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={generate}
          disabled={!canRun}
          className="w-full rounded-2xl bg-slate-800 py-5 text-xl font-bold text-white shadow-md transition active:scale-[0.98] disabled:bg-slate-300"
        >
          {loading ? '🤖 AI 寫文案中…（約 10 秒）' : r ? '🔁 重寫一版' : '📝 一鍵產上架文案'}
        </button>
        {!product.name.trim() && (
          <p className="text-center text-sm font-bold text-slate-400">先在上面填品名</p>
        )}
        {error && <p className="text-center text-sm font-bold text-rose-600">{error}</p>}
      </div>

      {r && (
        <div className="mt-4 space-y-3">
          {warns.length > 0 && (
            <div className="rounded-xl bg-amber-50 px-3 py-2">
              {warns.map((w, i) => (
                <p key={i} className="text-sm font-bold text-amber-700">
                  ⚠ {w}
                </p>
              ))}
            </div>
          )}

          <div>
            <label className={labelCls}>
              蝦皮標題{' '}
              <span className={`text-sm ${tLen > 60 || tLen < 55 ? 'font-bold text-rose-600' : 'text-slate-400'}`}>
                {tLen}/60（塞滿式，建議 55–60）
              </span>
            </label>
            <textarea
              readOnly
              rows={2}
              value={r.shopee_title}
              className="w-full resize-none rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-base text-slate-800 focus:outline-none"
            />
            <button
              type="button"
              onClick={copyTitle}
              className={`mt-2 w-full rounded-xl py-3 text-lg font-bold text-white transition active:scale-[0.98] ${
                titleCopied ? 'bg-emerald-500' : 'bg-teal-600'
              }`}
            >
              {titleCopied ? '✅ 標題已複製' : '📋 複製標題'}
            </button>
          </div>

          <div>
            <label className={labelCls}>完整內文（含規格、售後、hashtag）</label>
            <ResultBox value={assembleBody(r)} rows={14} />
          </div>
        </div>
      )}
    </section>
  )
}
