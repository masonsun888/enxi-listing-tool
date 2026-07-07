import { useEffect, useMemo, useRef, useState } from 'react'
import { MATERIALS } from '../prompts.js'
import { buildNine, TONE_OPTIONS, TA_PRESETS } from '../nineTemplates.js'
import { compressToJpeg, downloadDataUrl } from '../imageUtils.js'
import NineCard from './NineCard.jsx'
import NineCopyCard from './NineCopyCard.jsx'

const labelCls = 'mb-1 block text-base font-bold text-slate-700'
const inputCls =
  'w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-lg text-slate-800 focus:border-teal-500 focus:outline-none'

// [work 欄位, 顯示名, placeholder, spec_hints 對應 key]
const SPEC_FIELDS = [
  ['specCapacity', '容量', '例：500ml', 'capacity'],
  ['specWeight', '重量', '例：280g', 'weight'],
  ['specDiameter', '口徑', '例：7cm', 'diameter'],
  ['specHeight', '高度', '例：20cm', 'height'],
  ['specBottomWidth', '底寬', '例：6.5cm', 'bottom_width'],
]

// 「圖上寫 500ml」vs「你填 500 ml」這種只差空白大小寫的不算不一致。
function normSpec(s) {
  return String(s).replace(/\s+/g, '').toLowerCase()
}

const PICK_LABELS = [
  ['hero', '主圖'],
  ['intro', '賣點圖'],
  ['scene', '情境圖'],
  ['spec', '規格圖'],
  ['compare', '比較圖'],
]

// 定價三條線（佬筍公式原封搬過來）：蝦皮+發票 21%、包材 $2、物流 $4，從目標毛利率倒推。
function priceFromMargin(cost, m) {
  return Math.round((cost + 6 + cost * m) / 0.79)
}

const PRICE_LINES = [
  { m: 0, label: '出清線', desc: '打平就走，淘汰品用', color: 'text-slate-500' },
  { m: 0.15, label: '警示線', desc: '低於這條要注意', color: 'text-amber-600' },
  { m: 0.25, label: '建議售價', desc: '預設賣這個', color: 'text-teal-700' },
  { m: 0.35, label: '獲利線', desc: '理想目標', color: 'text-emerald-600' },
]

// 定價卡：填成本 → 四條線自動跳；選填「你想賣」→ 即時毛利率。
function PricingCard({ work, setWorkField, innerRef }) {
  const cost = parseFloat(work.cost)
  const hasCost = Number.isFinite(cost) && cost > 0
  const sell = parseFloat(work.nineSellPrice)
  const margin =
    hasCost && Number.isFinite(sell) && sell > 0 ? (sell * 0.79 - cost - 6) / sell : null
  const marginColor =
    margin === null ? '' : margin < 0 ? 'text-rose-600' : margin < 0.15 ? 'text-amber-600' : 'text-emerald-600'
  return (
    <section ref={innerRef} className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-bold text-slate-800">💰 定價（填成本就好）</h2>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="mb-0.5 text-sm font-semibold text-slate-500">進貨成本</p>
          <input
            type="text"
            inputMode="decimal"
            value={work.cost}
            onChange={(e) => setWorkField('cost', e.target.value)}
            placeholder="例：100"
            className={inputCls}
          />
        </div>
        <div>
          <p className="mb-0.5 text-sm font-semibold text-slate-500">你想賣（選填）</p>
          <input
            type="text"
            inputMode="decimal"
            value={work.nineSellPrice}
            onChange={(e) => setWorkField('nineSellPrice', e.target.value)}
            placeholder="例：199"
            className={inputCls}
          />
        </div>
      </div>
      {hasCost && (
        <div className="mt-3 space-y-1.5">
          {PRICE_LINES.map((line) => (
            <div key={line.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className={`text-sm font-bold ${line.color}`}>
                {line.label}
                <span className="ml-2 text-xs font-semibold text-slate-400">{line.desc}</span>
              </span>
              <span className={`text-lg font-extrabold ${line.color}`}>NT${priceFromMargin(cost, line.m)}</span>
            </div>
          ))}
          {margin !== null && (
            <p className={`pt-1 text-center text-sm font-bold ${marginColor}`}>
              賣 NT${sell} 的毛利率約 {(margin * 100).toFixed(1)}%
              {margin < 0 ? '（虧錢！）' : margin < 0.15 ? '（偏低）' : ''}
            </p>
          )}
          <p className="pt-1 text-xs text-slate-400">已含蝦皮＋發票 21%、包材 $2、物流 $4。</p>
        </div>
      )}
    </section>
  )
}

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

// 策略勾選卡的一列（chips + 選填自填框）
function ChipRow({ title, hint, options, activeIdx, onPick }) {
  return (
    <div>
      <p className="mb-1 text-sm font-bold text-slate-700">
        {title}
        {hint && <span className="ml-1 text-xs font-normal text-slate-400">{hint}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(i)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-bold active:scale-95 ${
              activeIdx === i ? 'bg-teal-600 text-white' : 'border-2 border-slate-200 bg-white text-slate-600'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

// 白牌九圖 v2：上傳素材＋填規格 → 勾一次策略 → 八張＋選項圖的製圖 prompt 工作單（配色交給 GPT）。
export default function NinePage({ product, setProduct, work, setWork, password }) {
  const [images, setImages] = useState([]) // { id, thumb, base64 }（只留在記憶體，不存檔）
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [colorDraft, setColorDraft] = useState('')
  const [titleDraft, setTitleDraft] = useState('') // 產生前的主標題輸入
  const [issueOpen, setIssueOpen] = useState(null) // 點開哪張圖的健檢問題
  const [budget, setBudget] = useState(null) // 本月 AI 額度（/api/usage）
  const fileRef = useRef(null)
  const cardRefs = useRef([]) // 九張卡片的 DOM，複製後自動捲到下一張
  const secRefs = useRef({}) // 一條龍四區塊的 DOM，頂部導航跳轉用

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

  // 策略勾選（v2）：一次勾選貫穿全部圖。舊存檔沒有 choices 就用預設空物件。
  const choices = (nine && nine.choices) || {}
  function updateChoice(patch) {
    updateNine({ choices: { ...choices, ...patch } })
  }

  // 主標題輸入：產生後綁 choices.customMainTitle（會存檔），產生前綁本地草稿。
  const customTitle = nine ? choices.customMainTitle || '' : titleDraft
  function setCustomTitle(v) {
    if (nine) updateChoice({ customMainTitle: v, mainTitlePick: undefined })
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
        setError('這張圖片格式不支援，請換 JPG/PNG（iPhone 照片可先在相簿用「分享」轉成 JPG）')
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
          choices: {
            sellingPointPick: 0,
            mainTitlePick: 0,
            customMainTitle: (nine ? choices.customMainTitle : titleDraft) || '',
            taPick: '',
            keyActionPick: 0,
            customKeyAction: '',
            toneOverride: '',
          },
          done: [],
          optionDone: {},
          copiedSlots: {},
        },
      }))
    } catch (err) {
      setError(String(err && err.message ? err.message : err))
    } finally {
      setAnalyzing(false)
    }
  }

  // 卡片：純函式重組，換策略勾選都是零 API 呼叫。
  const built = useMemo(() => {
    if (!nine) return null
    try {
      return buildNine(product, specs, nine.analysis, nine.choices || {})
    } catch {
      return null // 舊資料格式不完整就當沒有
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nine, product, work.specCapacity, work.specWeight, work.specDiameter, work.specHeight, work.specBottomWidth])

  const totalCards = built ? built.cards.length : 0
  const doneArr = built ? built.cards.map((_, i) => !!(nine.done && nine.done[i])) : []
  const doneCount = doneArr.filter(Boolean).length
  const materialCheck = nine && Array.isArray(nine.analysis.material_check) ? nine.analysis.material_check : []
  const imagePicks = (nine && nine.analysis.image_picks) || {}
  const specHints = (nine && nine.analysis.spec_hints) || {}

  // 「主圖用第1張、規格圖用第3張」摘要（只在縮圖還在畫面上時顯示，不然第幾張沒得對照）
  const picksLine =
    images.length > 0
      ? PICK_LABELS.filter(([key]) => Number.isInteger(imagePicks[key]))
          .map(([key, label]) => `${label}用第 ${imagePicks[key] + 1} 張`)
          .join('、')
      : ''

  function toggleDone(i) {
    const next = Array.isArray(nine.done) ? [...nine.done] : []
    next[i] = !next[i]
    updateNine({ done: next })
  }
  function toggleOptionDone(color) {
    const cur = (nine && nine.optionDone) || {}
    updateNine({ optionDone: { ...cur, [color]: !cur[color] } })
  }

  // 複製後：留下持久的「已複製」標記，並自動捲到下一張卡（i 是九張卡的序位；選項圖不捲）
  const copiedSlots = (nine && nine.copiedSlots) || {}
  function markCopied(slotKey, i) {
    updateNine({ copiedSlots: { ...copiedSlots, [slotKey]: true } })
    if (typeof i === 'number' && cardRefs.current[i + 1]) {
      setTimeout(() => cardRefs.current[i + 1].scrollIntoView({ behavior: 'smooth', block: 'start' }), 600)
    }
  }

  // 卡片的「存素材圖」：AI 建議第幾張、且那張縮圖還在畫面上才給按鈕
  function materialImageFor(card) {
    const idx = imagePicks[card.pickKey]
    if (!Number.isInteger(idx) || !images[idx]) return null
    const img = images[idx]
    return { index: idx, download: () => downloadDataUrl(img.thumb, `素材-第${idx + 1}張.jpg`) }
  }

  function imageIssues(index) {
    if (index >= MAX_ANALYZE_IMAGES) return null
    const c = materialCheck.find((m) => m && m.index === index)
    if (!c) return null
    const issues = Array.isArray(c.issues) ? c.issues : []
    if (c.usable !== false && issues.length === 0) return null
    return issues.length > 0 ? issues : ['AI 判定這張不適合拿去生圖']
  }

  // 一條龍導航：完成的區塊打勾
  const NAV = [
    { key: 'input', label: '🖼 素材資料', done: images.length > 0 || !!nine },
    { key: 'images', label: '🎨 製圖', done: totalCards > 0 && doneCount === totalCards },
    { key: 'copy', label: '📝 文案', done: !!(work.nineCopy && work.nineCopy.result) },
    { key: 'price', label: '💰 定價', done: !!(work.cost || '').trim() },
  ]
  function jumpTo(key) {
    const el = secRefs.current[key]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-4">
      {/* 一條龍導航（黏在頂部） */}
      <nav className="sticky top-0 z-20 grid grid-cols-4 gap-1.5 rounded-2xl bg-slate-100/95 py-1.5 backdrop-blur">
        {NAV.map((n) => (
          <button
            key={n.key}
            type="button"
            onClick={() => jumpTo(n.key)}
            className={`rounded-xl border-2 py-2 text-xs font-bold active:scale-95 ${
              n.done ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {n.label}
            {n.done ? ' ✓' : ''}
          </button>
        ))}
      </nav>

      {/* 三步驟：第一天上工也看得懂 */}
      <div className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-bold text-slate-600 shadow-sm">
        ① 上傳商品圖　→　② 填資料按按鈕　→　③ 圖給 ChatGPT、文案直接複製
      </div>

      {/* ① 素材區 */}
      <section ref={(el) => (secRefs.current.input = el)} className="rounded-2xl bg-white p-4 shadow-sm">
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
                  {imagePicks.hero === i && (
                    <span className="absolute -left-1.5 -top-1.5 rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      ⭐主圖
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {picksLine && (
          <p className="mt-2 rounded-xl bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800">
            ⭐ AI 素材分工：{picksLine}
            {imagePicks.rationale ? `。${imagePicks.rationale}` : ''}
          </p>
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
            {product.name.trim().length > 0 && product.name.trim().length < 4 && (
              <p className="mt-1 text-xs font-semibold text-amber-600">
                品名越具體，AI 想的標題越準（例：316不鏽鋼加厚湯匙）
              </p>
            )}
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
            {product.colors.length === 0 && (
              <p className="mt-1 text-xs text-slate-400">不填也可以，只是不會產生「選項圖」。</p>
            )}
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
              {SPEC_FIELDS.map(([key, label, ph, hintKey]) => {
                const hint = specHints[hintKey] || null
                const val = (work[key] || '').trim()
                const mismatch = !!(hint && val && normSpec(hint) !== normSpec(val))
                return (
                  <div key={key}>
                    <p className="mb-0.5 text-sm font-semibold text-slate-500">{label}</p>
                    <input
                      type="text"
                      value={work[key]}
                      onChange={(e) => setWorkField(key, e.target.value)}
                      placeholder={ph}
                      className={`${inputCls} ${mismatch ? 'border-amber-400' : ''}`}
                    />
                    {hint && !val && (
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                        <span>👀 圖上寫：{hint}</span>
                        <button
                          type="button"
                          onClick={() => setWorkField(key, hint)}
                          className="rounded-full bg-teal-600 px-2.5 py-1 text-xs font-bold text-white active:scale-95"
                        >
                          帶入
                        </button>
                      </p>
                    )}
                    {hint && val && !mismatch && (
                      <p className="mt-0.5 text-xs text-slate-400">👀 圖上寫：{hint}</p>
                    )}
                    {mismatch && (
                      <p className="mt-0.5 text-xs font-bold text-amber-600">
                        ⚠ 你填「{val}」，圖上寫「{hint}」，出貨前確認一下
                      </p>
                    )}
                  </div>
                )
              })}
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
            <p className="mt-1 text-xs text-slate-400">越短越有力，建議 6–10 字；太長泡泡藝術字會擠、張力被稀釋。</p>
          </div>
        </div>
      </section>

      {/* 本月 AI 額度 */}
      <BudgetBar budget={budget} />

      {/* ③ 大按鈕 */}
      <div ref={(el) => (secRefs.current.images = el)} />
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
      {nine && built && (
        <>
          {/* 策略勾選卡：勾一次，貫穿全部圖。配色/排版交給 GPT，工具只給策略。 */}
          <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-800">🎯 這套圖的策略（勾一次，全部套用）</h2>
              <p className="mt-0.5 text-xs text-slate-400">已幫你預設選好，覺得怪再改即可。配色、排版、質感交給 GPT，你只挑「要主打什麼」。</p>
            </div>

            {/* 主賣點（主） */}
            <ChipRow
              title="主打賣點"
              hint="畫面要圍繞這件事"
              options={(nine.analysis.copy.selling_points || []).map((sp) => sp.title)}
              activeIdx={choices.sellingPointPick ?? 0}
              onPick={(i) =>
                updateChoice({
                  sellingPointPick: i,
                  ...(choices.secondarySellingPick === i ? { secondarySellingPick: undefined } : {}),
                })
              }
            />

            {/* 次要賣點（選填）：凸顯主次，主圖會補一句「◯◯ 是次要」 */}
            {(() => {
              const sps = nine.analysis.copy.selling_points || []
              const mainIdx = choices.sellingPointPick ?? 0
              const others = sps.map((sp, i) => ({ title: sp.title, i })).filter((o) => o.i !== mainIdx)
              if (others.length === 0) return null
              const picked =
                Number.isInteger(choices.secondarySellingPick) && choices.secondarySellingPick !== mainIdx
                  ? choices.secondarySellingPick
                  : others[0].i
              const effIdx = choices.noSecondary ? null : picked
              return (
                <div>
                  <p className="mb-1 text-sm font-bold text-slate-700">
                    次要賣點<span className="ml-1 text-xs font-normal text-slate-400">選填，主圖會補一句「◯◯ 是次要」</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {others.map((o) => (
                      <button
                        key={o.i}
                        type="button"
                        onClick={() => updateChoice({ secondarySellingPick: o.i, noSecondary: false })}
                        className={`rounded-full px-3.5 py-1.5 text-sm font-bold active:scale-95 ${
                          effIdx === o.i ? 'bg-teal-600 text-white' : 'border-2 border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        {o.title}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => updateChoice({ noSecondary: true })}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-bold active:scale-95 ${
                        choices.noSecondary ? 'bg-slate-600 text-white' : 'border-2 border-slate-200 bg-white text-slate-400'
                      }`}
                    >
                      不強調次要
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* 主標題 */}
            <div>
              <ChipRow
                title="主標題"
                hint="越短越有力，建議 6–10 字（或到上方欄位自己打）"
                options={nine.analysis.copy.main_title_options || []}
                activeIdx={(choices.customMainTitle || '').trim() ? -1 : choices.mainTitlePick ?? 0}
                onPick={(i) => updateChoice({ mainTitlePick: i, customMainTitle: '' })}
              />
              {(choices.customMainTitle || '').trim() && (
                <p className="mt-1 text-xs font-semibold text-teal-700">
                  目前用你自己打的：{choices.customMainTitle}（清空上方主標題欄可改回候選）
                </p>
              )}
            </div>

            {/* 關鍵動作 */}
            <div>
              <p className="mb-1 text-sm font-bold text-slate-700">
                主圖關鍵動作<span className="ml-1 text-xs font-normal text-slate-400">主圖要有的那個畫面</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {(nine.analysis.copy.key_action_options || []).map((opt, i) => {
                  const active = !(choices.customKeyAction || '').trim() && (choices.keyActionPick ?? 0) === i
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => updateChoice({ keyActionPick: i, customKeyAction: '' })}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-bold active:scale-95 ${
                        active ? 'bg-teal-600 text-white' : 'border-2 border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
              <input
                type="text"
                value={choices.customKeyAction || ''}
                onChange={(e) => updateChoice({ customKeyAction: e.target.value })}
                placeholder="也可以自己打，例：手擠壓、冰塊掉出"
                className={`${inputCls} mt-2`}
              />
            </div>

            {/* TA 受眾 + 調性 */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-sm font-bold text-slate-700">賣給誰</p>
                <select
                  value={choices.taPick || ''}
                  onChange={(e) => updateChoice({ taPick: e.target.value })}
                  className={inputCls}
                >
                  <option value="">AI 判定：{nine.analysis.copy.target_audience || '一般消費者'}</option>
                  {TA_PRESETS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1 text-sm font-bold text-slate-700">整體調性<span className="ml-1 text-xs font-normal text-slate-400">九張的連貫感</span></p>
                <select
                  value={choices.toneOverride || ''}
                  onChange={(e) => updateChoice({ toneOverride: e.target.value })}
                  className={inputCls}
                >
                  <option value="">自動：{built.tone}</option>
                  {TONE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* 怎麼貼給 GPT 小抄（第一次用的人看的，看過就收起來） */}
          <details className="rounded-2xl bg-white p-4 shadow-sm">
            <summary className="cursor-pointer text-base font-bold text-slate-700">
              📖 第一次用？怎麼貼給 ChatGPT（點開看）
            </summary>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
              <li>打開 ChatGPT（手機 App 或網頁），開一個新對話。</li>
              <li>按卡片上的「📋 複製」，貼到 ChatGPT 的輸入框。</li>
              <li>
                再附上圖片一起送出：按卡片的「⬇ 存素材圖」會存到手機，在 ChatGPT 選「最近的照片」就是它。
                第 1 張 Hero 要多附一張「標準版型參考圖」（卡片上有下載鈕）。
              </li>
              <li>圖生出來後，照卡片的「文字核對清單」逐字檢查；有錯字直接回它「有錯字，重生」。</li>
              <li>這張搞定就勾右上角「完成」，會自動幫你記進度。</li>
            </ol>
          </details>

          {/* 進度列（黏在一條龍導航下面） */}
          <div className="sticky top-12 z-10 rounded-2xl bg-teal-600 px-4 py-3 text-center text-lg font-extrabold text-white shadow">
            已完成 {doneCount} / {totalCards}
          </div>
          <div className="rounded-2xl bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-700">
            🔥 主圖／規格圖最重要，值得多花力氣重生到滿意；🌊 中間幾張「充門面、能看即可」，別卡太久。
          </div>

          {/* 九張卡片 */}
          {built.cards.map((card, i) => (
            <div key={card.slot} ref={(el) => (cardRefs.current[i] = el)}>
              <NineCard
                card={card}
                done={!!doneArr[i]}
                onToggleDone={() => toggleDone(i)}
                isHero={card.slot === 1}
                materialImage={materialImageFor(card)}
                copiedBefore={!!copiedSlots[card.slot]}
                onCopied={() => markCopied(card.slot, i)}
              />
            </div>
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
                    copiedBefore={!!copiedSlots[card.slot]}
                    onCopied={() => markCopied(card.slot)}
                  />
                )
              })}
            </>
          )}

        </>
      )}

      {/* 📝 一鍵上架文案（不用先分析也能用；有分析卡會自動吃它的賣點/客群） */}
      <NineCopyCard
        product={product}
        work={work}
        setWork={setWork}
        password={password}
        setBudget={setBudget}
        overBudget={overBudget}
        innerRef={(el) => (secRefs.current.copy = el)}
      />

      {/* 💰 定價 */}
      <PricingCard work={work} setWorkField={setWorkField} innerRef={(el) => (secRefs.current.price = el)} />

      <p className="pb-2 text-center text-sm text-slate-400">
        ☁️ 分析結果、文案和進度會自動存檔，之後從下方「已存商品」載入就能接著做。
      </p>
    </div>
  )
}
