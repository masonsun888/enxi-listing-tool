import { useEffect, useState } from 'react'
import ProductForm from './components/ProductForm.jsx'
import SavedProducts from './components/SavedProducts.jsx'
import TitleTab from './components/TitleTab.jsx'
import BodyTab from './components/BodyTab.jsx'
import ImageTab from './components/ImageTab.jsx'
import PriceTab from './components/PriceTab.jsx'
import NinePage from './components/NinePage.jsx'
import OptimizePage from './components/OptimizePage.jsx'
import HomePage from './components/HomePage.jsx'
import Footer from './components/Footer.jsx'
import LockScreen from './components/LockScreen.jsx'
import { makeDefaultProduct, makeNineDefaultProduct, makeEmptyWork } from './defaults.js'

const TABS = [
  { key: 'title', label: '標題' },
  { key: 'body', label: '內文' },
  { key: 'image', label: '製圖' },
  { key: 'price', label: '定價' },
]

const MODES = [
  { key: 'home', label: '🏠 首頁' },
  { key: 'classic', label: '🗂 經典模式' },
  { key: 'optimize', label: '🔧 優化舊品' },
  { key: 'nine', label: '⚡ 新品九圖' },
]

const PW_KEY = 'enxi_pw'

// 頂欄常駐的迷你額度指示（read-only，自己抓 /api/usage；不影響各模式內部流程）。
function TopBudget({ budget }) {
  if (!budget || !budget.tracked) return null
  const full = budget.usedTWD >= budget.limitTWD
  const dot = full ? 'bg-rose-500' : budget.percent >= 80 ? 'bg-amber-400' : 'bg-accent'
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-muted"
      title={`本月 AI 額度：NT$${budget.usedTWD} / NT$${budget.limitTWD}`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="font-mono">
        NT${budget.usedTWD}/{budget.limitTWD}
      </span>
    </span>
  )
}

export default function App() {
  // 首頁／使用說明為預設；新品九圖＝全新一整套；優化舊品＝在售品局部補強；經典模式＝原有四分頁（樂扣、珍珠照舊）。
  const [mode, setMode] = useState('home')
  const [product, setProduct] = useState(makeNineDefaultProduct)
  const [work, setWork] = useState(makeEmptyWork)
  const [currentId, setCurrentId] = useState(null)
  const [tab, setTab] = useState('title')
  const [budget, setBudget] = useState(null)

  // 密碼鎖：'checking' | 'open' | 'locked'。後端未設密碼時一律 open。
  // 密碼記在 localStorage：換分頁、關掉重開都不用重輸（內部工具，方便優先）。
  const [authState, setAuthState] = useState('checking')
  const [password, setPassword] = useState(
    () => localStorage.getItem(PW_KEY) || sessionStorage.getItem(PW_KEY) || '',
  )

  useEffect(() => {
    const headers = password ? { 'x-app-password': password } : {}
    fetch('/api/products', { headers })
      .then((r) => {
        if (r.status === 401) setAuthState('locked')
        else setAuthState('open') // 200=通過；其他狀態(503/網路)交給 SavedProducts 退回本機
      })
      .catch(() => setAuthState('open')) // 連不到後端 → 本機模式，不擋
  }, [password])

  // 頂欄額度：跟 NinePage 各自抓一次（read-only，不共用 state 才不動內部流程）。
  useEffect(() => {
    if (authState !== 'open') return
    fetch('/api/usage', { headers: password ? { 'x-app-password': password } : {} })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && d.budget && setBudget(d.budget))
      .catch(() => {})
  }, [authState, password])

  function unlock(pw) {
    localStorage.setItem(PW_KEY, pw)
    setPassword(pw)
    setAuthState('checking')
  }

  // 切模式時，如果商品還是另一個模式的「全新空白」狀態，就換成目標模式的空白預設；
  // 已載入或改過的商品原封不動帶過去。（optimize 不換商品，沿用目前的。）
  function switchMode(next) {
    if (next === mode) return
    const pristine = JSON.stringify(product)
    if (next === 'classic' && pristine === JSON.stringify(makeNineDefaultProduct()))
      setProduct(makeDefaultProduct())
    if (next === 'nine' && pristine === JSON.stringify(makeDefaultProduct()))
      setProduct(makeNineDefaultProduct())
    setMode(next)
    window.scrollTo({ top: 0 })
  }

  if (authState === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-muted">載入中⋯</div>
    )
  }

  if (authState === 'locked') {
    return <LockScreen onUnlock={unlock} />
  }

  // 側欄用哪個空白預設，取決於目前模式（optimize 沿用新品的空白）。
  const blankForMode = mode === 'classic' ? makeDefaultProduct : makeNineDefaultProduct
  const overBudget = !!(budget && budget.tracked && budget.usedTWD >= budget.limitTWD)

  return (
    <div className="min-h-screen">
      {/* 頂欄：工具名｜三顆模式｜額度（桌機常駐，手機模式列換行） */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
          <h1 className="text-lg font-bold text-primary">恩希上架工具</h1>
          <div className="order-3 w-full md:order-none md:w-auto">
            <nav className="grid grid-cols-2 gap-1.5 md:flex">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => switchMode(m.key)}
                  className={`rounded-[8px] px-3 py-2 text-sm font-bold transition active:scale-[0.98] ${
                    mode === m.key
                      ? 'bg-primary text-white shadow-sm'
                      : 'border border-line bg-surface text-ink/70 hover:bg-line/40'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="ml-auto">
            <TopBudget budget={budget} />
          </div>
        </div>
      </header>

      {/* 首頁／使用說明：全寬、無側欄。 */}
      {mode === 'home' && (
        <div className="mx-auto max-w-[1000px] px-4 py-6">
          <HomePage onPick={switchMode} />
        </div>
      )}

      {/* 主體：左側商品欄（桌機常駐）＋主工作區（≤960）。手機收成單欄、側欄移到下方。 */}
      {mode !== 'home' && (
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-4 md:flex-row md:items-start md:gap-6">
          <aside className="order-2 md:order-1 md:sticky md:top-[68px] md:w-[260px] md:shrink-0">
            <SavedProducts
              product={product}
              setProduct={setProduct}
              work={work}
              setWork={setWork}
              currentId={currentId}
              setCurrentId={setCurrentId}
              password={password}
              makeBlankProduct={blankForMode}
            />
          </aside>

          <main className="order-1 min-w-0 md:order-2 md:flex-1">
            <div className="mx-auto max-w-[960px]">
              {mode === 'nine' && (
              <NinePage
                product={product}
                setProduct={setProduct}
                work={work}
                setWork={setWork}
                password={password}
              />
            )}

            {mode === 'optimize' && (
              <OptimizePage
                product={product}
                work={work}
                setWork={setWork}
                password={password}
                setBudget={setBudget}
                overBudget={overBudget}
              />
            )}

            {mode === 'classic' && (
              <>
                <ProductForm product={product} setProduct={setProduct} />

                {/* 分頁切換（黏在頂欄下方） */}
                <nav className="sticky top-[60px] z-10 mt-5 grid grid-cols-4 gap-2 rounded-[12px] border border-line bg-bg/95 p-2 backdrop-blur">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTab(t.key)}
                      className={`rounded-[8px] py-3 text-lg font-bold transition active:scale-[0.97] ${
                        tab === t.key
                          ? 'bg-primary text-white shadow'
                          : 'border border-line bg-surface text-ink/70'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </nav>

                <div className="mt-3 rounded-[12px] border border-line bg-surface p-4 shadow-sm">
                  {tab === 'title' && <TitleTab product={product} work={work} setWork={setWork} />}
                  {tab === 'body' && <BodyTab product={product} work={work} setWork={setWork} />}
                  {tab === 'image' && <ImageTab product={product} work={work} setWork={setWork} />}
                  {tab === 'price' && <PriceTab product={product} work={work} setWork={setWork} />}
                </div>
              </>
            )}

              <Footer />
            </div>
          </main>
        </div>
      )}

      {/* 版權／公司資訊：整頁最底，所有模式都顯示 */}
      <footer className="mt-4 border-t border-line bg-surface">
        <div className="mx-auto max-w-[1280px] px-4 py-6 text-center text-xs leading-relaxed text-muted">
          <p className="font-bold text-ink">恩希貿易有限公司</p>
          <p className="mt-1">統一編號 90362242｜高雄市苓雅區凱旋三路 615 號 1 樓</p>
          <p className="mt-1">
            電話 <a className="hover:text-primary" href="tel:07-7880807">07-7880807</a>
            {' ｜ '}
            <a className="hover:text-primary" href="mailto:dreamteaa22@gmail.com">
              dreamteaa22@gmail.com
            </a>
          </p>
          <p className="mt-2 text-[11px] text-muted/70">© 2026 恩希貿易有限公司・內部上架工具</p>
        </div>
      </footer>
    </div>
  )
}
