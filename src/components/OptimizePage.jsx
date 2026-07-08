import { useState } from 'react'
import { checkTitle, checkMessages, checkIntro, introMessages, TITLE_MAX } from '../titleCheck.js'

// 優化舊品：給在售品局部補強。PR-A-fix：卡1 改成「單次 AI 直出 2–3 個完整標題」，
// 選字規則全在後端，員工只做：貼競品 →（選填）填必埋詞 → 挑一個標題（可直接編輯）。
// 卡2/卡3 佔位，PR-B/PR-C 上線。全部走新設計 token（酒紅 primary／霧金 accent）。

const MUST_MAX = 4

const inputCls =
  'w-full rounded-[8px] border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted/60 focus:border-primary focus:outline-none'

const EMPTY = {
  currentTitle: '',
  competitorTitles: '',
  mustInclude: [],
  titleResults: [],
  rationale: null,
  introResults: [],
  introAux: [],
  introShownIdx: 0,
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

export default function OptimizePage({ product, work, setWork, password, setBudget, overBudget }) {
  const opt = work.optimize || EMPTY
  const [openCard, setOpenCard] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedIdx, setCopiedIdx] = useState(-1)
  const [copiedIntroIdx, setCopiedIntroIdx] = useState(-1)
  const [mustDraft, setMustDraft] = useState('')

  function update(patch) {
    setWork((w) => ({ ...w, optimize: { ...(w.optimize || EMPTY), ...patch } }))
  }

  const hasName = !!product.name.trim()
  const mustInclude = opt.mustInclude || []
  const main = (opt.rationale && opt.rationale.main) || ''

  function addMust() {
    const v = mustDraft.trim()
    if (v && !mustInclude.includes(v) && mustInclude.length < MUST_MAX) update({ mustInclude: [...mustInclude, v] })
    setMustDraft('')
  }
  function removeMust(k) {
    update({ mustInclude: mustInclude.filter((x) => x !== k) })
  }

  async function genTitles() {
    const comps = (opt.competitorTitles || '').split('\n').map((s) => s.trim()).filter(Boolean)
    if (comps.length === 0 || loading || overBudget) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(password ? { 'x-app-password': password } : {}) },
        body: JSON.stringify({
          mode: 'optimize-title',
          productName: product.name,
          currentTitle: (opt.currentTitle || product.name || '').trim(),
          competitorTitles: comps,
          mustInclude,
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
        titleResults: data.titles || [],
        rationale: data.rationale || null,
        shownIdx: 0,
        introResults: data.intros || [],
        introAux: data.introAux || [],
        introShownIdx: 0,
      })
    } catch (err) {
      setError(String(err && err.message ? err.message : err))
    } finally {
      setLoading(false)
    }
  }

  function editTitle(i, val) {
    const next = [...(opt.titleResults || [])]
    next[i] = val
    update({ titleResults: next })
  }

  function editIntro(i, val) {
    const next = [...(opt.introResults || [])]
    next[i] = val
    update({ introResults: next })
  }

  async function copyText(text, kind, i) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    if (kind === 'intro') {
      setCopiedIntroIdx(i)
      setTimeout(() => setCopiedIntroIdx(-1), 1800)
    }
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

  const rationale = opt.rationale
  const titles = opt.titleResults || []

  return (
    <div className="space-y-4">
      <div className="rounded-[12px] border border-line bg-surface px-5 py-3 text-sm font-semibold text-muted">
        🔧 優化舊品：在售品局部補強。先在左側選一個已存商品（或新建填品名），再展開下面的卡。
      </div>

      {/* 卡1：標題關鍵字優化 */}
      <Card
        icon="🔑"
        title="標題關鍵字優化"
        subtitle="貼競品 →（選填）填必埋詞 → 一鍵直出可編輯標題"
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

        <label className="mb-1 mt-4 block text-sm font-bold text-ink">競品標題（一行一條，5–10 條）</label>
        <textarea
          rows={5}
          value={opt.competitorTitles}
          onChange={(e) => update({ competitorTitles: e.target.value })}
          placeholder={
            '搜你的目標關鍵字 → 點進前排同品類商品 → 複製「完整標題」貼入（一行一條，5–10 條）。\n別貼列表頁截斷的標題。'
          }
          className={`${inputCls} resize-none`}
        />

        {/* 必埋詞 */}
        <label className="mb-1 mt-4 block text-sm font-bold text-ink">
          必埋詞（選填，最多 {MUST_MAX} 個）
        </label>
        <p className="mb-1.5 text-xs text-muted">
          這個品要強調且「屬實」的詞：贈品、SGS 檢測、隔日到貨…（沒有就留空）。
          <br />
          必埋詞會「一字不差」放進標題，送出前檢查錯字。
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={mustDraft}
            onChange={(e) => setMustDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addMust()
              }
            }}
            placeholder="輸入後按新增"
            disabled={mustInclude.length >= MUST_MAX}
            className={inputCls}
          />
          <button
            type="button"
            onClick={addMust}
            disabled={mustInclude.length >= MUST_MAX}
            className="shrink-0 rounded-[8px] border border-line px-4 py-2.5 text-base font-bold text-ink active:scale-95 disabled:opacity-40"
          >
            新增
          </button>
        </div>
        {mustInclude.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {mustInclude.map((k) => (
              <span
                key={k}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-sm font-semibold text-ink"
              >
                {k}
                <button type="button" onClick={() => removeMust(k)} className="text-muted active:text-ink" aria-label={`移除 ${k}`}>
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={genTitles}
          disabled={!(opt.competitorTitles || '').trim() || loading || overBudget}
          className="mt-4 w-full rounded-[8px] bg-primary py-3 text-lg font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          {loading ? '🤖 AI 寫標題中…' : titles.length > 0 ? '再寫一次（老闆再付一次錢 💸）' : '🤖 AI 幫你寫標題'}
        </button>
        <p className="mt-1 text-center text-xs text-muted">
          按一次老闆掏一次錢（約 NT$0.5）💰 競品貼好貼滿再按，一次到位
        </p>
        {overBudget && <p className="mt-2 text-center text-sm font-bold text-rose-600">本月 AI 額度已用完</p>}

        {/* AI 寫好的標題：只顯示排序第一的一個，「換一句」輪替備選（不重打、不花錢） */}
        {titles.length > 0 &&
          (() => {
            const idx = Math.min(opt.shownIdx || 0, titles.length - 1)
            const t = titles[idx]
            const c = checkTitle(t, { main, mustInclude })
            const msgs = checkMessages(c)
            const ok = msgs.length === 0
            const multi = titles.length > 1
            return (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-bold text-ink">AI 寫好的標題（不滿意可直接改）</p>
                <div className="rounded-[8px] border border-line p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`font-mono text-xs ${c.over || c.tooShort ? 'font-bold text-rose-600' : 'text-muted'}`}>
                      {c.len}/{TITLE_MAX} 字{multi ? `　（第 ${idx + 1}/${titles.length} 句）` : ''}
                    </span>
                    <span className={`text-xs font-bold ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {ok ? '✓ 全過' : '✕ 有問題'}
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={t}
                    onChange={(e) => editTitle(idx, e.target.value)}
                    className="w-full resize-none rounded-[8px] border border-line bg-surface p-2.5 text-base text-ink focus:border-primary focus:outline-none"
                  />
                  {msgs.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {msgs.map((m, j) => (
                        <li key={j} className="text-xs font-semibold text-rose-600">
                          ✕ {m}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => copyTitle(t, idx)}
                      className={`flex-1 rounded-[8px] py-2.5 text-base font-bold text-white transition active:scale-[0.98] ${
                        copiedIdx === idx ? 'bg-emerald-500' : 'bg-ink'
                      }`}
                    >
                      {copiedIdx === idx ? '✅ 已複製' : '📋 複製這個'}
                    </button>
                    {multi && (
                      <button
                        type="button"
                        onClick={() => update({ shownIdx: (idx + 1) % titles.length })}
                        className="shrink-0 rounded-[8px] border border-line px-4 py-2.5 text-base font-bold text-ink active:scale-95"
                      >
                        🔄 換一句
                      </button>
                    )}
                  </div>
                  {multi && <p className="mt-1 text-xs text-muted">免費換，儘管按（循環切換，每句都能複製）</p>}
                </div>

                {/* 為什麼這樣選字（教員工用，預設收合） */}
                {rationale && (
                  <details className="rounded-[8px] border border-line bg-bg/40 px-3 py-2">
                    <summary className="cursor-pointer text-sm font-bold text-muted">💡 為什麼這樣選字</summary>
                    <div className="mt-2 space-y-2 text-sm">
                      <p className="text-xs leading-relaxed text-muted">
                        主關鍵字放最前面、蝦皮權重最高；長複合詞（如「捏捏樂製冰桶」）已涵蓋它的短詞（「製冰桶」），不重複佔字數。
                      </p>
                      {rationale.main && (
                        <p className="text-ink">
                          主關鍵字：<span className="font-bold">{rationale.main}</span>
                        </p>
                      )}
                      {Array.isArray(rationale.picked) && rationale.picked.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-muted">選入：</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {rationale.picked.map((p, i) => (
                              <span key={i} className="rounded-full bg-line/50 px-2 py-0.5 text-xs text-ink">
                                {p.keyword}
                                <span className="text-muted">
                                  {' '}
                                  ·{p.type || '—'}·{p.count}次
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {Array.isArray(rationale.excluded) && rationale.excluded.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-muted">排除（為什麼不用）：</p>
                          <ul className="mt-1 space-y-0.5">
                            {rationale.excluded.map((p, i) => (
                              <li key={i} className="text-xs text-muted">
                                <span className="font-bold text-ink">{p.keyword}</span> → {p.reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            )
          })()}

        {error && <p className="mt-2 text-center text-sm font-bold text-rose-600">{error}</p>}
      </Card>

      {/* 卡2：內文前 100 字（跟卡1 同一次呼叫免費附贈） */}
      <Card
        icon="✍️"
        title="內文前 100 字鋪字"
        subtitle="跟標題一起產、不另外花錢"
        open={openCard === 2}
        onToggle={() => setOpenCard(openCard === 2 ? 0 : 2)}
      >
        {(opt.introResults || []).length === 0 ? (
          <p className="rounded-[8px] bg-bg/60 px-3 py-3 text-sm text-muted">
            先到上面卡1 按「🤖 AI 幫你寫標題」——內文前 100 字會「一起產出」（同一次呼叫、不另外花錢），完成後這裡自動出現。
          </p>
        ) : (
          (() => {
            const arr = opt.introResults
            const iidx = Math.min(opt.introShownIdx || 0, arr.length - 1)
            const t = arr[iidx]
            const c = checkIntro(t, { main, aux: opt.introAux || [] })
            const msgs = introMessages(c)
            const ok = msgs.length === 0
            const multi = arr.length > 1
            return (
              <div className="space-y-2">
                <p className="text-xs text-muted">
                  貼到蝦皮內文「最前面」。100 字之後你自己接原本的內文；主關鍵字在前 30 字、關鍵字不硬塞。
                </p>
                <div className="rounded-[8px] border border-line p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`font-mono text-xs ${c.tooShort ? 'font-bold text-rose-600' : 'text-muted'}`}>
                      {c.len} 字{multi ? `　（第 ${iidx + 1}/${arr.length} 段）` : ''}
                    </span>
                    <span className={`text-xs font-bold ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {ok ? '✓ 全過' : '✕ 有問題'}
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={t}
                    onChange={(e) => editIntro(iidx, e.target.value)}
                    className="w-full resize-none rounded-[8px] border border-line bg-surface p-2.5 text-base text-ink focus:border-primary focus:outline-none"
                  />
                  {msgs.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {msgs.map((m, j) => (
                        <li key={j} className="text-xs font-semibold text-rose-600">
                          ✕ {m}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => copyText(t, 'intro', iidx)}
                      className={`flex-1 rounded-[8px] py-2.5 text-base font-bold text-white transition active:scale-[0.98] ${
                        copiedIntroIdx === iidx ? 'bg-emerald-500' : 'bg-ink'
                      }`}
                    >
                      {copiedIntroIdx === iidx ? '✅ 已複製' : '📋 複製這段'}
                    </button>
                    {multi && (
                      <button
                        type="button"
                        onClick={() => update({ introShownIdx: (iidx + 1) % arr.length })}
                        className="shrink-0 rounded-[8px] border border-line px-4 py-2.5 text-base font-bold text-ink active:scale-95"
                      >
                        🔄 換一段
                      </button>
                    )}
                  </div>
                  {multi && <p className="mt-1 text-xs text-muted">免費換，儘管按（跟標題一起產的，不另外花錢）</p>}
                </div>
              </div>
            )
          })()
        )}
      </Card>

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
