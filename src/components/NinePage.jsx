import { useEffect, useMemo, useRef, useState } from 'react'
import { MATERIALS } from '../prompts.js'
import { buildNine } from '../nineTemplates.js'
import { compressToJpeg } from '../imageUtils.js'
import NineCard from './NineCard.jsx'

const labelCls = 'mb-1 block text-base font-bold text-slate-700'
const inputCls =
  'w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-lg text-slate-800 focus:border-teal-500 focus:outline-none'

const SPEC_FIELDS = [
  ['specCapacity', '容量', '例：500ml'],
  ['specWeight', '重量', '例：280g'],
  ['specDiameter', '口徑', '例：7cm'],
  ['specHeight', '高度', '例：20cm'],
  ['specBottomWidth', '底寬', '例：6.5cm'],
]

const MAX_ANALYZE_IMAGES = 4

// 本月 AI 額度進度條：用滿變紅、超過 8 成變黃。
function BudgetBar({ budget }) {
  if (!budget || !budget.tracked) return null
  const full = budget.usedTWD >= budget.limitTWD
  const barColor = full ? 'bg-rose-500' : budget.percent >= 80 ? 'bg-amber-400' : 'bg-teal-500'
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-sm font-bold text-slate-700">
        <span>🪙 本月 AI 分析額度</span>
        <span>
          NT${budget.usedTWD} / NT${budget.limitTWD}
        </span>
      </div>
      <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.max(budget.percent, budget.usedTWD > 0 ? 2 : 0)}%` }}
        />
      </div>
      <p className={`mt-1 text-xs ${full ? 'font-bold text-rose-600' : 'text-slate-400'}`}>
        {full
          ? '額度已用完，下月 1 號自動重置（要調整上限請找 Mason）'
          : `本月已分析 ${budget.calls} 次，每次不到 NT$1`}
      </p>
    </section>
  )
}

// 配色卡上的一格色塊
function Swatch({ colors, label }) {
  const style =
    colors.length > 1
      ? { background: `linear-gradient(90deg, ${colors[0]}, ${colors[1]})` }
      : { background: colors[0] }
  return (
    <div className="flex-1 text-center">
      <div className="h-12 w-full rounded-xl border border-black/10" style={style} />
      <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
    </div>
  )
}

// 白牌九圖：上傳素材＋填規格 → 一顆按鈕 → 九張配色連貫的製圖 prompt 工作單。
export default function NinePage({ product, setProduct, work, setWork, password }) {
  const [images, setImages] = useState([]) // { id, thumb, base64 }（只留在記憶體，不存檔）
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [colorDraft, setColorDraft] = useState('')
  const [titleDraft, setTitleDraft] = useState('') // 產生前的主標題輸入
  const [issueOpen, setIssueOpen] = useState(null) // 點開哪張圖的健檢問題
  const [budget, setBudget] = useState(null) // 本月 AI 額度（/api/usage）
  const fileRef = useRef(null)

  useEffect(() => {
    fetch('/api/usage', { headers: password ? { 'x-app-password': password } : {} })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && d.budget && setBudget(d.budget))
      .catch(() => {}) // 本機模式沒有後端就不顯示進度條
  }, [password])

  const nine = work.nine && work.nine.analysis ? work.nine : null
  const specs = {
    capacity: work.specCapacity,
    weight: work.specWeight,
    diameter: work.specDiameter,
    height: work.specHeight,
    bottomWidth: work.specBottomWidth,
  }

  function updateNine(patch) {
    setWork((w) => ({ ...w, nine: { ...w.nine, ...patch } }))
  }
  const setWorkField = (k, v) => setWork((w) => ({ ...w, [k]: v }))
  const setProductField = (k, v) => setProduct((p) => ({ ...p, [k]: v }))

  // 主標題輸入：產生後綁 work.nine.customMainTitle（會存檔），產生前綁本地草稿。
  const customTitle = nine ? nine.customMainTitle || '' : titleDraft
  function setCustomTitle(v) {
    if (nine) updateNine({ customMainTitle: v })
    else setTitleDraft(v)
  }

  async function onFiles(e) {
    const files = Array.from(e.target.files || [])
    setError('')
    for (const f of files) {
      try {
        const { dataUrl, base64 } = await compressToJpeg(f)
        setImages((list) => [...list, { id: `${Date.now()}-${list.length}-${Math.random()}`, thumb: dataUrl, base64 }])
      } catch {
        setError('有圖片讀取失敗，請換一張再試')
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeImage(id) {
    setImages((list) => list.filter((img) => img.id !== id))
  }

  const missing = []
  if (images.length === 0) missing.push('商品素材圖')
  if (!product.name.trim()) missing.push('品名')
  const overBudget = !!(budget && budget.tracked && budget.usedTWD >= budget.limitTWD)

  async function generate() {
    if (missing.length > 0 || analyzing || overBudget) return
    setError('')
    setAnalyzing(true)
    try {
      const sizeParts = SPEC_FIELDS.map(([key, label]) => {
        const v = (work[key] || '').trim()
        return v ? `${label}${v}` : ''
      }).filter(Boolean)
      const res = await fetch('/api/analyze', {
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
            size: sizeParts.join('、') || product.size,
          },
          images: images.slice(0, MAX_ANALYZE_IMAGES).map((img) => ({ media_type: 'image/jpeg', data: img.base64 })),
        }),
      })
      if (res.status === 503) throw new Error('後台尚未設定 AI 金鑰，請先 wrangler secret put ANTHROPIC_API_KEY')
      if (res.status === 429) {
        const d = await res.json().catch(() => ({}))
        if (d.budget) setBudget(d.budget)
        throw new Error(d.error || '本月 AI 額度已用完')
      }
      if (!res.ok) throw new Error('AI 忙線中，再按一次')
      const data = await res.json()
      if (data.budget) setBudget(data.budget)
      if (!data.analysis) throw new Error('AI 忙線中，再按一次')
      setWork((w) => ({
        ...w,
        nine: {
          analysis: data.analysis,
          palettePick: 'main',
          customMainTitle: (nine ? nine.customMainTitle : titleDraft) || '',
          mainTitlePick: 0,
          done: Array(9).fill(false),
          optionDone: {},
        },
      }))
    } catch (err) {
      setError(String(err && err.message ? err.message : err))
    } finally {
      setAnalyzing(false)
    }
  }

  // 九張卡片：純函式重組，換配色／換主標都是零 API 呼叫。
  const built = useMemo(() => {
    if (!nine) return null
    try {
      return buildNine(product, specs, nine.analysis, nine.palettePick, nine.customMainTitle, nine.mainTitlePick)
    } catch {
      return null // 舊資料格式不完整就當沒有
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nine, product, work.specCapacity, work.specWeight, work.specDiameter, work.specHeight, work.specBottomWidth])

  const pal = nine ? (nine.palettePick === 'alt' ? nine.analysis.palette_alt : nine.analysis.palette) : null
  const doneArr = nine && Array.isArray(nine.done) ? nine.done : Array(9).fill(false)
  const doneCount = doneArr.filter(Boolean).length
  const materialCheck = nine && Array.isArray(nine.analysis.material_check) ? nine.analysis.material_check : []

  function toggleDone(i) {
    const next = [...doneArr]
    next[i] = !next[i]
    updateNine({ done: next })
  }
  function toggleOptionDone(color) {
    const cur = (nine && nine.optionDone) || {}
    updateNine({ optionDone: { ...cur, [color]: !cur[color] } })
  }

  function imageIssues(index) {
    if (index >= MAX_ANALYZE_IMAGES) return null
    const c = materialCheck.find((m) => m && m.index === index)
    if (!c) return null
    const issues = Array.isArray(c.issues) ? c.issues : []
    if (c.usable !== false && issues.length === 0) return null
    return issues.length > 0 ? issues : ['AI 判定這張不適合拿去生圖']
  }

  return (
    <div className="space-y-4">
      {/* ① 素材區 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-slate-800">🖼️ 商品素材</h2>
        <button
          type="button"
          onClick={() => fileRef.current && fileRef.current.click()}
          className="w-full rounded-2xl border-4 border-dashed border-slate-300 bg-slate-50 py-8 text-lg font-bold text-slate-500 active:scale-[0.99]"
        >
          ＋ 上傳商品素材
          <span className="mt-1 block text-sm font-semibold text-slate-400">1688 圖或實拍，可多張</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} className="hidden" />

        {images.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {images.map((img, i) => {
              const issues = imageIssues(i)
              return (
                <div key={img.id} className="relative">
                  <img
                    src={img.thumb}
                    alt={`素材 ${i + 1}`}
                    onClick={() => issues && setIssueOpen(issueOpen === i ? null : i)}
                    className={`h-20 w-20 rounded-xl border-2 object-cover ${
                      issues ? 'border-rose-400' : 'border-slate-200'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    aria-label="移除這張圖"
                    className="absolute -right-1.5 -bottom-1.5 h-6 w-6 rounded-full bg-slate-600 text-xs font-bold text-white"
                  >
                    ✕
                  </button>
                  {issues && (
                    <button
                      type="button"
                      onClick={() => setIssueOpen(issueOpen === i ? null : i)}
                      className="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full bg-rose-500 text-xs font-bold text-white"
                      aria-label="這張圖有問題"
                    >
                      ⚠
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {issueOpen !== null && imageIssues(issueOpen) && (
          <div className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            ⚠ 第 {issueOpen + 1} 張：{imageIssues(issueOpen).join('；')}。別給 GPT 用這張。
          </div>
        )}
        {images.length > MAX_ANALYZE_IMAGES && (
          <p className="mt-2 text-xs text-slate-400">AI 只分析前 {MAX_ANALYZE_IMAGES} 張，其餘照常給 GPT 生圖用。</p>
        )}
      </section>

      {/* ② 資料區 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-slate-800">📦 商品資料</h2>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>品名</label>
            <input
              type="text"
              value={product.name}
              onChange={(e) => setProductField('name', e.target.value)}
              placeholder="例：316不鏽鋼保溫杯"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>材質</label>
            <select
              value={product.material}
              onChange={(e) => setProductField('material', e.target.value)}
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
            <label className={labelCls}>顏色（有幾色就加幾個，會產選項圖）</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={colorDraft}
                onChange={(e) => setColorDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const c = colorDraft.trim()
                    if (c && !product.colors.includes(c)) setProductField('colors', [...product.colors, c])
                    setColorDraft('')
                  }
                }}
                placeholder="輸入顏色後按新增"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => {
                  const c = colorDraft.trim()
                  if (c && !product.colors.includes(c)) setProductField('colors', [...product.colors, c])
                  setColorDraft('')
                }}
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
                      onClick={() => setProductField('colors', product.colors.filter((c) => c !== color))}
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

          <div>
            <label className={labelCls}>規格（有就填，數字會原封不動排進規格圖）</label>
            <div className="grid grid-cols-2 gap-2">
              {SPEC_FIELDS.map(([key, label, ph]) => (
                <div key={key}>
                  <p className="mb-0.5 text-sm font-semibold text-slate-500">{label}</p>
                  <input
                    type="text"
                    value={work[key]}
                    onChange={(e) => setWorkField(key, e.target.value)}
                    placeholder={ph}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>主標題（選填）</label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="留空 AI 幫你想"
              className={inputCls}
            />
          </div>
        </div>
      </section>

      {/* 本月 AI 額度 */}
      <BudgetBar budget={budget} />

      {/* ③ 大按鈕 */}
      <button
        type="button"
        onClick={generate}
        disabled={missing.length > 0 || analyzing || overBudget}
        className="w-full rounded-2xl bg-teal-600 py-6 text-2xl font-extrabold text-white shadow-md transition active:scale-[0.98] disabled:bg-slate-300"
      >
        {analyzing ? '🤖 AI 分析中…（約 10 秒）' : nine ? '🔁 重新分析（重產九張）' : '🚀 產生九張圖指令'}
      </button>
      {overBudget && (
        <p className="text-center text-sm font-bold text-rose-600">
          本月 AI 額度已用完，暫時無法分析（已存的九張指令照常可用）
        </p>
      )}
      {!overBudget && missing.length > 0 && (
        <p className="text-center text-sm font-bold text-slate-400">還缺：{missing.join('、')}</p>
      )}
      {error && <p className="text-center text-sm font-bold text-rose-600">{error}</p>}

      {/* ===== 產生後：同頁往下長出 ===== */}
      {nine && built && pal && (
        <>
          {/* 配色卡 */}
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">🎨 這套圖的配色</h2>
              <button
                type="button"
                onClick={() => updateNine({ palettePick: nine.palettePick === 'alt' ? 'main' : 'alt' })}
                className="rounded-xl border-2 border-teal-500 px-3 py-2 text-sm font-bold text-teal-700 active:scale-95"
              >
                🔄 換一組
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <Swatch colors={pal.bg_gradient} label="背景漸層" />
              <Swatch colors={[pal.title_fill]} label="主標色" />
              <Swatch colors={[pal.accent]} label="強調色" />
            </div>
            {pal.rationale && <p className="mt-2 text-sm text-slate-500">{pal.rationale}</p>}
            <p className="mt-1 text-xs text-slate-400">
              目前：{nine.palettePick === 'alt' ? '備選配色' : '主配色'}。換一組會瞬間重組九張指令。
            </p>
          </section>

          {/* 主標候選 */}
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-bold text-slate-800">✏️ 主標題（點一個套用）</h2>
            <div className="flex flex-wrap gap-2">
              {nine.analysis.copy.main_title_options.map((opt, i) => {
                const active = !(nine.customMainTitle || '').trim() && nine.mainTitlePick === i
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => updateNine({ mainTitlePick: i, customMainTitle: '' })}
                    className={`rounded-full px-4 py-2 text-base font-bold active:scale-95 ${
                      active ? 'bg-teal-600 text-white' : 'border-2 border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
            {(nine.customMainTitle || '').trim() && (
              <p className="mt-2 text-sm font-semibold text-teal-700">
                目前用你自己打的：{nine.customMainTitle}（清空上方輸入框可改回候選）
              </p>
            )}
          </section>

          {/* 進度列 */}
          <div className="sticky top-0 z-10 rounded-2xl bg-teal-600 px-4 py-3 text-center text-lg font-extrabold text-white shadow">
            已完成 {doneCount} / 9
          </div>

          {/* 九張卡片 */}
          {built.cards.map((card, i) => (
            <NineCard
              key={card.slot}
              card={card}
              done={!!doneArr[i]}
              onToggleDone={() => toggleDone(i)}
              isHero={card.slot === 1}
            />
          ))}

          {/* 選項圖卡片 */}
          {built.optionCards.length > 0 && (
            <>
              <h2 className="pt-2 text-lg font-bold text-slate-800">🎨 選項圖（每個顏色一張）</h2>
              {built.optionCards.map((card) => {
                const color = card.label.split('｜')[1]
                return (
                  <NineCard
                    key={card.slot}
                    card={card}
                    done={!!(nine.optionDone && nine.optionDone[color])}
                    onToggleDone={() => toggleOptionDone(color)}
                    isHero={false}
                  />
                )
              })}
            </>
          )}

          <p className="pb-2 text-center text-sm text-slate-400">
            做完記得按下方的「💾 儲存此商品」，下次載入不用重新分析。
          </p>
        </>
      )}
    </div>
  )
}
