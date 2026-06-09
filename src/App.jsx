import { useState } from 'react'
import ProductForm from './components/ProductForm.jsx'
import TitleTab from './components/TitleTab.jsx'
import BodyTab from './components/BodyTab.jsx'
import ImageTab from './components/ImageTab.jsx'
import Footer from './components/Footer.jsx'

const TABS = [
  { key: 'title', label: '標題' },
  { key: 'body', label: '內文' },
  { key: 'image', label: '製圖' },
]

export default function App() {
  const [product, setProduct] = useState({
    brand: '樂扣',
    name: '',
    size: '',
    material: '不鏽鋼',
    colors: [],
  })
  const [tab, setTab] = useState('title')

  return (
    <div className="mx-auto min-h-screen w-full max-w-[480px] bg-slate-100 px-4 pb-10 pt-4">
      <header className="mb-4 text-center">
        <h1 className="text-2xl font-extrabold text-teal-700">恩希上架工具</h1>
        <p className="mt-1 text-sm text-slate-500">填空 → 產生 → 複製，貼到蝦皮 / Momo / GPT</p>
      </header>

      <ProductForm product={product} setProduct={setProduct} />

      {/* 分頁切換 */}
      <nav className="sticky top-0 z-10 mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 py-2">
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
        {tab === 'title' && <TitleTab product={product} />}
        {tab === 'body' && <BodyTab product={product} />}
        {tab === 'image' && <ImageTab product={product} />}
      </main>

      <Footer />
    </div>
  )
}
