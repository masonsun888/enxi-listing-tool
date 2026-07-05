import { useEffect, useState } from 'react'
import ProductForm from './components/ProductForm.jsx'
import SavedProducts from './components/SavedProducts.jsx'
import TitleTab from './components/TitleTab.jsx'
import BodyTab from './components/BodyTab.jsx'
import ImageTab from './components/ImageTab.jsx'
import PriceTab from './components/PriceTab.jsx'
import NinePage from './components/NinePage.jsx'
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
  { key: 'nine', label: '⚡ 白牌九圖' },
  { key: 'classic', label: '🗂 經典模式' },
]

const PW_KEY = 'enxi_pw'

export default function App() {
  // 白牌九圖為預設；經典模式＝原有四分頁工作流（樂扣、珍珠照舊）。
  const [mode, setMode] = useState('nine')
  const [product, setProduct] = useState(makeNineDefaultProduct)
  const [work, setWork] = useState(makeEmptyWork)
  const [currentId, setCurrentId] = useState(null)
  const [tab, setTab] = useState('title')

  // 密碼鎖：'checking' | 'open' | 'locked'。後端未設密碼時一律 open。
  const [authState, setAuthState] = useState('checking')
  const [password, setPassword] = useState(() => sessionStorage.getItem(PW_KEY) || '')

  useEffect(() => {
    const headers = password ? { 'x-app-password': password } : {}
    fetch('/api/products', { headers })
      .then((r) => {
        if (r.status === 401) setAuthState('locked')
        else setAuthState('open') // 200=通過；其他狀態(503/網路)交給 SavedProducts 退回本機
      })
      .catch(() => setAuthState('open')) // 連不到後端 → 本機模式，不擋
  }, [password])

  function unlock(pw) {
    sessionStorage.setItem(PW_KEY, pw)
    setPassword(pw)
    setAuthState('checking')
  }

  // 切模式時，如果商品還是另一個模式的「全新空白」狀態，就換成目標模式的空白預設；
  // 已載入或改過的商品原封不動帶過去。
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
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-400">
        載入中⋯
      </div>
    )
  }

  if (authState === 'locked') {
    return <LockScreen onUnlock={unlock} />
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[480px] bg-slate-100 px-4 pb-10 pt-4">
      <header className="mb-4 text-center">
        <h1 className="text-2xl font-extrabold text-teal-700">恩希上架工具</h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'nine'
            ? '上傳素材 → 一顆按鈕 → 九張圖指令逐張貼給 GPT'
            : '填空 → 產生 → 複製，貼到蝦皮 / Momo / GPT'}
        </p>
      </header>

      {/* 模式切換 */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => switchMode(m.key)}
            className={`rounded-2xl py-4 text-lg font-extrabold transition active:scale-[0.97] ${
              mode === m.key
                ? 'bg-teal-600 text-white shadow'
                : 'bg-white text-slate-500 border-2 border-slate-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'nine' ? (
        <>
          <NinePage
            product={product}
            setProduct={setProduct}
            work={work}
            setWork={setWork}
            password={password}
          />
          <SavedProducts
            product={product}
            setProduct={setProduct}
            work={work}
            setWork={setWork}
            currentId={currentId}
            setCurrentId={setCurrentId}
            password={password}
            makeBlankProduct={makeNineDefaultProduct}
          />
        </>
      ) : (
        <>
          <ProductForm product={product} setProduct={setProduct} />

          <SavedProducts
            product={product}
            setProduct={setProduct}
            work={work}
            setWork={setWork}
            currentId={currentId}
            setCurrentId={setCurrentId}
            password={password}
            makeBlankProduct={makeDefaultProduct}
          />

          {/* 分頁切換 */}
          <nav className="sticky top-0 z-10 mt-5 grid grid-cols-4 gap-2 rounded-2xl bg-slate-100 py-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-xl py-3 text-lg font-bold transition active:scale-[0.97] ${
                  tab === t.key
                    ? 'bg-teal-600 text-white shadow'
                    : 'bg-white text-slate-600 border-2 border-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <main className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
            {tab === 'title' && <TitleTab product={product} work={work} setWork={setWork} />}
            {tab === 'body' && <BodyTab product={product} work={work} setWork={setWork} />}
            {tab === 'image' && <ImageTab product={product} work={work} setWork={setWork} />}
            {tab === 'price' && <PriceTab product={product} work={work} setWork={setWork} />}
          </main>
        </>
      )}

      <Footer />
    </div>
  )
}
