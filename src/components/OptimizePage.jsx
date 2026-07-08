import { useRef, useState } from 'react'
import { checkTitle, checkMessages, checkIntro, introMessages, TITLE_MAX } from '../titleCheck.js'
import { compressToJpeg, downloadDataUrl } from '../imageUtils.js'
import { buildNine, TA_PRESETS, TONE_OPTIONS } from '../nineTemplates.js'
import { setActiveVariant, daysSince, shouldRemindAB, statusLabel, VARIANT_STATUS } from '../heroVariants.js'

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
  heroAnalysis: null,
  heroChoices: {},
  hero: { variants: [] },
}

// 酒紅 token 的勾選 chip
function Chip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-bold active:scale-95 ${
        active ? 'bg-primary text-white' : 'border border-line bg-surface text-muted'
      }`}
    >
      {label}
    </button>
  )
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
  // 卡3 Hero
  const [heroImages, setHeroImages] = useState([]) // {id, thumb, base64}（只在記憶體）
  const [heroAnalyzing, setHeroAnalyzing] = useState(false)
  const [heroError, setHeroError] = useState('')
  const [heroCopied, setHeroCopied] = useState(false)
  const heroFileRef = useRef(null)

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

  // ===== 卡3 Hero 重製 =====
  const heroAnalysis = opt.heroAnalysis || null
  const heroChoices = opt.heroChoices || {}
  const heroVariants = (opt.hero && opt.hero.variants) || []
  function updateHeroChoice(patch) {
    update({ heroChoices: { ...heroChoices, ...patch } })
  }
  // 復用九圖引擎：Hero 卡就是 buildNine 的第一張（specs 用不到給空物件）。
  let heroBuilt = null
  try {
    if (heroAnalysis) heroBuilt = buildNine(product, {}, heroAnalysis, heroChoices)
  } catch {
    heroBuilt = null
  }
  const heroCard = heroBuilt ? heroBuilt.cards[0] : null

  async function onHeroFiles(e) {
    const files = Array.from(e.target.files || [])
    setHeroError('')
    for (const f of files) {
      try {
        const { dataUrl, base64 } = await compressToJpeg(f)
        setHeroImages((list) => [...list, { id: `${list.length}-${Math.random()}`, thumb: dataUrl, base64 }])
      } catch {
        setHeroError('這張圖片格式不支援，請換 JPG/PNG')
      }
    }
    if (heroFileRef.current) heroFileRef.current.value = ''
  }

  async function analyzeHero() {
    if (heroImages.length === 0 || heroAnalyzing || overBudget || !hasName) return
    setHeroError('')
    setHeroAnalyzing(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(password ? { 'x-app-password': password } : {}) },
        body: JSON.stringify({
          product: { name: product.name, material: product.material, colors: product.colors, size: product.size },
          images: heroImages.slice(0, 4).map((img) => ({ media_type: 'image/jpeg', data: img.base64 })),
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
      if (!res.ok || !data.analysis) throw new Error(data.error || 'AI 忙線中，再按一次')
      update({
        heroAnalysis: data.analysis,
        heroChoices: { sellingPointPick: 0, mainTitlePick: 0, keyActionPick: 0, taPick: '', toneOverride: '' },
      })
    } catch (err) {
      setHeroError(String(err && err.message ? err.message : err))
    } finally {
      setHeroAnalyzing(false)
    }
  }

  async function copyHero() {
    if (!heroCard) return
    await copyText(heroCard.prompt, 'hero', 0)
    setHeroCopied(true)
    setTimeout(() => setHeroCopied(false), 1800)
  }

  function saveVariant() {
    if (!heroCard) return
    const snapshot = [
      heroBuilt.cards[0].textChecklist[0] || '',
      `賣點：${(heroAnalysis.copy.selling_points || [])[heroChoices.sellingPointPick ?? 0]?.title || ''}`,
    ]
      .filter(Boolean)
      .join('｜')
    const id = (crypto.randomUUID && crypto.randomUUID()) || `v-${heroVariants.length}-${Math.random()}`
    const variant = {
      id,
      prompt: heroCard.prompt,
      strategySnapshot: snapshot,
      status: heroVariants.length === 0 ? VARIANT_STATUS.LIVE : VARIANT_STATUS.TESTING,
      createdAt: Date.now(),
    }
    update({ hero: { variants: [variant, ...heroVariants] } })
  }
  function makeLive(id) {
    update({ hero: { variants: setActiveVariant(heroVariants, id) } })
  }
  function removeVariant(id) {
    update({ hero: { variants: heroVariants.filter((v) => v.id !== id) } })
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

      {/* 卡3：Hero 單張重製（複用九圖五句 Hero＋A/B 版本） */}
      <Card
        icon="🖼"
        title="Hero 單張重製"
        subtitle="上傳圖 → AI 分析 → 五句 Hero → 存 A/B 版本"
        open={openCard === 3}
        onToggle={() => setOpenCard(openCard === 3 ? 0 : 3)}
      >
        {!hasName && (
          <p className="mb-3 rounded-[8px] bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
            先在左側選一個已存商品，或新建並填「品名」。
          </p>
        )}
        {shouldRemindAB(heroVariants) && (
          <p className="mb-3 rounded-[8px] bg-accent/15 px-3 py-2 text-sm font-bold text-ink">
            📅 現役 Hero 上架超過兩週了，考慮重產一張打擂台比成效。
          </p>
        )}

        {/* 上傳素材 */}
        <button
          type="button"
          onClick={() => heroFileRef.current && heroFileRef.current.click()}
          className="w-full rounded-[8px] border-2 border-dashed border-line bg-bg/40 py-6 text-base font-bold text-muted active:scale-[0.99]"
        >
          ＋ 上傳商品實拍圖（可多張）
        </button>
        <input ref={heroFileRef} type="file" accept="image/*" multiple onChange={onHeroFiles} className="hidden" />
        {heroImages.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {heroImages.map((img) => (
              <img key={img.id} src={img.thumb} alt="素材" className="h-16 w-16 rounded-[8px] border border-line object-cover" />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={analyzeHero}
          disabled={heroImages.length === 0 || heroAnalyzing || overBudget || !hasName}
          className="mt-3 w-full rounded-[8px] bg-primary py-3 text-lg font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          {heroAnalyzing ? '🤖 AI 分析中…' : heroAnalysis ? '🔁 重新分析' : '🤖 AI 分析商品（產五要素）'}
        </button>
        <p className="mt-1 text-center text-xs text-muted">按一次老闆掏一次錢（約 NT$0.5）💰</p>
        {heroError && <p className="mt-2 text-center text-sm font-bold text-rose-600">{heroError}</p>}

        {/* 五要素策略（分析後出現） */}
        {heroAnalysis && heroCard && (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-bold text-ink">這張 Hero 的策略（勾一次，覺得怪再改）</p>

            <div>
              <p className="mb-1 text-sm font-bold text-ink">主打賣點</p>
              <div className="flex flex-wrap gap-2">
                {(heroAnalysis.copy.selling_points || []).map((sp, i) => (
                  <Chip
                    key={i}
                    label={sp.title}
                    active={(heroChoices.sellingPointPick ?? 0) === i}
                    onClick={() => updateHeroChoice({ sellingPointPick: i })}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm font-bold text-ink">
                主標題<span className="ml-1 text-xs font-normal text-muted">越短越有力</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {(heroAnalysis.copy.main_title_options || []).map((t, i) => (
                  <Chip
                    key={i}
                    label={t}
                    active={!(heroChoices.customMainTitle || '').trim() && (heroChoices.mainTitlePick ?? 0) === i}
                    onClick={() => updateHeroChoice({ mainTitlePick: i, customMainTitle: '' })}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm font-bold text-ink">
                主圖關鍵動作<span className="ml-1 text-xs font-normal text-muted">要有的那個畫面</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {(heroAnalysis.copy.key_action_options || []).map((opt2, i) => (
                  <Chip
                    key={i}
                    label={opt2}
                    active={!(heroChoices.customKeyAction || '').trim() && (heroChoices.keyActionPick ?? 0) === i}
                    onClick={() => updateHeroChoice({ keyActionPick: i, customKeyAction: '' })}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-sm font-bold text-ink">賣給誰</p>
                <select
                  value={heroChoices.taPick || ''}
                  onChange={(e) => updateHeroChoice({ taPick: e.target.value })}
                  className={inputCls}
                >
                  <option value="">AI 判定：{heroAnalysis.copy.target_audience || '一般消費者'}</option>
                  {TA_PRESETS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1 text-sm font-bold text-ink">整體調性</p>
                <select
                  value={heroChoices.toneOverride || ''}
                  onChange={(e) => updateHeroChoice({ toneOverride: e.target.value })}
                  className={inputCls}
                >
                  <option value="">自動：{heroBuilt.tone}</option>
                  {TONE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Hero prompt */}
            <div className="rounded-[8px] border border-line p-3">
              <p className="mb-1 text-sm font-bold text-ink">Hero 製圖指令（貼給 GPT）</p>
              <textarea
                readOnly
                rows={11}
                value={heroCard.prompt}
                className="w-full resize-none rounded-[8px] border border-line bg-bg/40 p-2.5 text-sm leading-relaxed text-ink focus:outline-none"
              />
              <a
                href="/assets/hero-ref-1.png"
                download="hero-ref-1.png"
                className="mt-2 block rounded-[8px] border border-line bg-surface px-3 py-2 text-center text-sm font-bold text-ink active:scale-[0.98]"
              >
                ⬇ 下載標準版型參考圖（貼 GPT 時附上）
              </a>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={copyHero}
                  className={`flex-1 rounded-[8px] py-2.5 text-base font-bold text-white transition active:scale-[0.98] ${
                    heroCopied ? 'bg-emerald-500' : 'bg-ink'
                  }`}
                >
                  {heroCopied ? '✅ 已複製' : '📋 複製指令'}
                </button>
                <button
                  type="button"
                  onClick={saveVariant}
                  className="shrink-0 rounded-[8px] border border-primary px-4 py-2.5 text-base font-bold text-primary active:scale-95"
                >
                  💾 存成版本
                </button>
              </div>
            </div>
          </div>
        )}

        {/* A/B 版本列表 */}
        {heroVariants.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-bold text-ink">A/B 版本（{heroVariants.length}）</p>
            <div className="space-y-2">
              {heroVariants.map((v) => {
                const d = daysSince(v.createdAt)
                return (
                  <div
                    key={v.id}
                    className={`rounded-[8px] border p-3 ${
                      v.status === VARIANT_STATUS.LIVE ? 'border-primary bg-primary/5' : 'border-line'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-ink">
                        {statusLabel(v.status)}
                        {d !== null && <span className="ml-2 font-mono text-xs font-normal text-muted">上架 {d} 天</span>}
                      </span>
                      <span className="flex shrink-0 gap-1.5">
                        {v.status !== VARIANT_STATUS.LIVE && (
                          <button
                            type="button"
                            onClick={() => makeLive(v.id)}
                            className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white active:scale-95"
                          >
                            設為現役
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeVariant(v.id)}
                          className="rounded-full border border-line px-3 py-1 text-xs font-bold text-muted active:scale-95"
                        >
                          刪
                        </button>
                      </span>
                    </div>
                    {v.strategySnapshot && <p className="mt-1 truncate text-xs text-muted">{v.strategySnapshot}</p>}
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-muted">上架 1–2 週後產新版打擂台；哪版贏由你看蝦皮後台自己標「設為現役」。</p>
          </div>
        )}
      </Card>
    </div>
  )
}
