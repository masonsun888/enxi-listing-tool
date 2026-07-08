import { useState } from 'react'

// 優化舊品：給在售品局部補強。PR-A 只做卡1（標題關鍵字優化）；卡2/卡3 佔位，PR-B/PR-C 上線。
// 全部走新設計 token（酒紅 primary／霧金 accent／line 框）。

const TITLE_MAX = 60 // 與 worker/copy.js 一致
const AUX_MAX = 3

const inputCls =
  'w-full rounded-[8px] border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted/60 focus:border-primary focus:outline-none'

const EMPTY = {
  currentTitle: '',
  competitorTitles: '',
  candidates: [],
  suggested: null,
  mainKw: '',
  auxKws: [],
  titleResults: [],
  titleChecks: [],
}

// 收合式卡片外殼
function Card({ icon, title, subtitle, open, onToggle, disabled, children }) {
  return (
    <section className="rounded-[12px] border border-line bg-surface shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left"
      >
        <span>
          <span className="text-base font-bold text-ink">
            {icon} {title}
          </span>
          {subtitle && <span className="mt-0.5 block text-xs text-muted">{subtitle}</span>}
        </span>
        <span className="shrink-0 text-muted">{disabled ? '🔒' : open ? '▲' : '▼'}</span>
      </button>
      {open && !disabled && <div className="border-t border-line px-5 py-4">{children}</div>}
    </section>
  )
}

// 品檢一列：pass 灰勾、fail 紅字＋怎麼修
function CheckRow({ ok, label, fix }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        ok ? 'bg-line/40 text-muted' : 'bg-rose-50 text-rose-600'
      }`}
    >
      {ok ? '✓' : '✕'} {ok ? label : fix || label}
    </span>
  )
}

export default function OptimizePage({ product, work, setWork, password, setBudget, overBudget }) {
  const opt = work.optimize || EMPTY
  const [openCard, setOpenCard] = useState(1)
  const [kwLoading, setKwLoading] = useState(false)
  const [titleLoading, setTitleLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedIdx, setCopiedIdx] = useState(-1)

  function update(patch) {
    setWork((w) => ({ ...w, optimize: { ...(w.optimize || EMPTY), ...patch } }))
  }

  const hasName = !!product.name.trim()
  const authHeaders = password ? { 'x-app-password': password } : {}

  async function findKeywords() {
    const titles = (opt.competitorTitles || '').split('\n').map((s) => s.trim()).filter(Boolean)
    if (titles.length === 0 || kwLoading || overBudget) return
    setError('')
    setKwLoading(true)
    try {
      const res = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          productName: product.name,
          currentTitle: (opt.currentTitle || product.name || '').trim(),
          competitorTitles: titles,
        }),
      })
      if (res.status === 503) throw new Error('後台尚未設定 AI 金鑰')
      if (res.status === 429) {
        const d = await res.json().catch(() => ({}))
        if (d.budget) setBudget(d.budget)
        throw new Error(d.error || '本月 AI 額度已用完')
      }
      const data = await res.json()
      if (data.budget) setBudget(data.budget)
      if (!res.ok) throw new Error(data.error || 'AI 忙線中，再按一次')
      update({
        candidates: data.candidates || [],
        suggested: data.suggested || null,
        mainKw: (data.suggested && data.suggested.main) || '',
        auxKws: (data.suggested && data.suggested.aux) || [],
        titleResults: [],
        titleChecks: [],
      })
    } catch (err) {
      setError(String(err && err.message ? err.message : err))
    } finally {
      setKwLoading(false)
    }
  }

  async function genTitles() {
    if (!opt.mainKw || titleLoading || overBudget) return
    setError('')
    setTitleLoading(true)
    try {
      const res = await fetch('/api/copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          mode: 'optimize-title',
          product: { name: product.name, material: product.material },
          currentTitle: (opt.currentTitle || product.name || '').trim(),
          keywords: { main: opt.mainKw, aux: opt.auxKws },
        }),
      })
      if (res.status === 503) throw new Error('後台尚未設定 AI 金鑰')
      if (res.status === 429) {
        const d = await res.json().catch(() => ({}))
        if (d.budget) setBudget(d.budget)
        throw new Error(d.error || '本月 AI 額度已用完')
      }
      const data = await res.json()
      if (data.budget) setBudget(data.budget)
      if (!res.ok) throw new Error(data.error || 'AI 忙線中，再按一次')
      update({ titleResults: data.titles || [], titleChecks: data.titleChecks || [] })
    } catch (err) {
      setError(String(err && err.message ? err.message : err))
    } finally {
      setTitleLoading(false)
    }
  }

  function setMain(kw) {
    update({ mainKw: opt.mainKw === kw ? '' : kw, auxKws: opt.auxKws.filter((k) => k !== kw) })
  }
  function toggleAux(kw) {
    if (kw === opt.mainKw) return
    if (opt.auxKws.includes(kw)) update({ auxKws: opt.auxKws.filter((k) => k !== kw) })
    else if (opt.auxKws.length < AUX_MAX) update({ auxKws: [...opt.auxKws, kw] })
  }

  async function copyTitle(title, i) {
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
    setCopiedIdx(i)
    setTimeout(() => setCopiedIdx(-1), 1800)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[12px] border border-line bg-surface px-5 py-3 text-sm font-semibold text-muted">
        🔧 優化舊品：在售品局部補強。先在左側選一個已存商品（或新建填品名），再展開下面的卡。
      </div>

      {/* 卡1：標題關鍵字優化 */}
      <Card
        icon="🔑"
        title="標題關鍵字優化"
        subtitle="貼競品標題 → AI 抓關鍵字 → 勾主/輔 → 產優化標題"
        open={openCard === 1}
        onToggle={() => setOpenCard(openCard === 1 ? 0 : 1)}
      >
        {!hasName && (
          <p className="mb-3 rounded-[8px] bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
            先在左側選一個已存商品，或新建並填「品名」。
          </p>
        )}

        <label className="mb-1 block text-sm font-bold text-ink">現有標題（選填，會自動帶品名）</label>
        <input
          type="text"
          value={opt.currentTitle}
          onChange={(e) => update({ currentTitle: e.target.value })}
          placeholder={product.name || '例：316不鏽鋼保溫杯'}
          className={inputCls}
        />

        <label className="mb-1 mt-4 block text-sm font-bold text-ink">
          競品標題（一行一條，建議 5–10 條）
        </label>
        <textarea
          rows={5}
          value={opt.competitorTitles}
          onChange={(e) => update({ competitorTitles: e.target.value })}
          placeholder={'去蝦皮搜你的品，把「前排」賣得好的商品標題整條複製貼進來，一行一個。\nAI 只抄品類/屬性詞，不會抄別人品牌。'}
          className={`${inputCls} resize-none`}
        />

        <button
          type="button"
          onClick={findKeywords}
          disabled={!(opt.competitorTitles || '').trim() || kwLoading || overBudget}
          className="mt-3 w-full rounded-[8px] bg-primary py-3 text-lg font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          {kwLoading ? '🤖 AI 找關鍵字中…' : '🔍 AI 找關鍵字'}
        </button>
        {overBudget && (
          <p className="mt-2 text-center text-sm font-bold text-rose-600">本月 AI 額度已用完</p>
        )}

        {/* 候選清單 */}
        {opt.candidates && opt.candidates.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-bold text-ink">
              勾主關鍵字（1 個）＋輔助（最多 {AUX_MAX} 個）
              <span className="ml-1 font-normal text-muted">依競品出現次數排序</span>
            </p>
            <div className="space-y-1.5">
              {opt.candidates.map((c) => {
                const isMain = opt.mainKw === c.keyword
                const isAux = opt.auxKws.includes(c.keyword)
                return (
                  <div
                    key={c.keyword}
                    className={`flex items-center justify-between gap-2 rounded-[8px] border px-3 py-2 ${
                      isMain
                        ? 'border-primary bg-primary/5'
                        : isAux
                          ? 'border-accent bg-accent/10'
                          : 'border-line bg-surface'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="text-base font-bold text-ink">{c.keyword}</span>
                      <span className="ml-2 font-mono text-xs text-muted">
                        出現 {c.count} 次·第 {c.sources.map((n) => n + 1).join(',')} 條
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setMain(c.keyword)}
                        className={`rounded-full px-3 py-1 text-xs font-bold active:scale-95 ${
                          isMain ? 'bg-primary text-white' : 'border border-line text-muted'
                        }`}
                      >
                        主
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAux(c.keyword)}
                        disabled={isMain || (!isAux && opt.auxKws.length >= AUX_MAX)}
                        className={`rounded-full px-3 py-1 text-xs font-bold active:scale-95 disabled:opacity-30 ${
                          isAux ? 'bg-accent text-white' : 'border border-line text-muted'
                        }`}
                      >
                        輔
                      </button>
                    </span>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={genTitles}
              disabled={!opt.mainKw || titleLoading || overBudget}
              className="mt-3 w-full rounded-[8px] bg-primary py-3 text-lg font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
            >
              {titleLoading ? '🤖 產生優化標題中…' : '✍️ 產生優化標題'}
            </button>
            {!opt.mainKw && (
              <p className="mt-1 text-center text-xs text-muted">先點一個「主」關鍵字</p>
            )}
          </div>
        )}

        {/* 標題候選 */}
        {opt.titleResults && opt.titleResults.length > 0 && (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-bold text-ink">優化標題候選（挑一個複製貼後台）</p>
            {opt.titleResults.map((t, i) => {
              const c = opt.titleChecks[i] || {}
              return (
                <div key={i} className="rounded-[8px] border border-line p-3">
                  <p className="text-base text-ink">{t}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <CheckRow ok={!c.over} label={`${c.len ?? 0}/${TITLE_MAX} 字`} fix={`${c.len} 字，超過 ${TITLE_MAX}`} />
                    <CheckRow ok={c.mainFirst !== false} label="主字前置" fix="主關鍵字不在前面" />
                    <CheckRow
                      ok={!c.auxMissing || c.auxMissing.length === 0}
                      label="輔助字齊全"
                      fix={`缺：${(c.auxMissing || []).join('、')}`}
                    />
                    <CheckRow
                      ok={!c.forbiddenHits || c.forbiddenHits.length === 0}
                      label="無禁字"
                      fix={`禁字：${(c.forbiddenHits || []).join('、')}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => copyTitle(t, i)}
                    className={`mt-2 w-full rounded-[8px] py-2.5 text-base font-bold text-white transition active:scale-[0.98] ${
                      copiedIdx === i ? 'bg-emerald-500' : 'bg-ink'
                    }`}
                  >
                    {copiedIdx === i ? '✅ 已複製' : '📋 複製這個'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {error && <p className="mt-2 text-center text-sm font-bold text-rose-600">{error}</p>}
      </Card>

      {/* 卡2：內文前 100 字（PR-B） */}
      <Card
        icon="✍️"
        title="內文前 100 字鋪字"
        subtitle="依卡1勾好的關鍵字鋪內文開頭"
        open={false}
        onToggle={() => {}}
        disabled
      />

      {/* 卡3：Hero 重製（PR-C） */}
      <Card
        icon="🖼"
        title="Hero 單張重製"
        subtitle="複用九圖五句 Hero＋A/B 版本"
        open={false}
        onToggle={() => {}}
        disabled
      />
    </div>
  )
}
