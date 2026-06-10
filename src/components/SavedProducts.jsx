import { useEffect, useState } from 'react'
import { makeDefaultProduct } from '../defaults.js'

const KEY = 'enxi_saved_products'

function loadSaved() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function fmtDate(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 商品儲存：存到瀏覽器本機，方便日後載入微調、追蹤哪些商品已做過。
export default function SavedProducts({ product, setProduct, currentId, setCurrentId }) {
  const [saved, setSaved] = useState(loadSaved)
  const [open, setOpen] = useState(false)
  const [flash, setFlash] = useState('')

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(saved))
  }, [saved])

  function notify(msg) {
    setFlash(msg)
    setTimeout(() => setFlash(''), 1800)
  }

  function saveCurrent() {
    if (!product.name.trim()) {
      notify('請先填品名再儲存')
      return
    }
    const now = Date.now()
    const data = {
      brand: product.brand,
      name: product.name,
      size: product.size,
      material: product.material,
      colors: product.colors,
    }
    if (currentId && saved.some((s) => s.id === currentId)) {
      setSaved((list) =>
        list.map((s) => (s.id === currentId ? { ...s, ...data, updatedAt: now } : s)),
      )
      notify('已更新此商品')
    } else {
      const id = String(now)
      setSaved((list) => [{ id, note: '', ...data, updatedAt: now }, ...list])
      setCurrentId(id)
      notify('已儲存新商品')
    }
    setOpen(true)
  }

  function loadItem(item) {
    setProduct({
      brand: item.brand,
      name: item.name,
      size: item.size,
      material: item.material,
      colors: Array.isArray(item.colors) ? item.colors : [],
    })
    setCurrentId(item.id)
    notify(`已載入：${item.name}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function remove(id) {
    setSaved((list) => list.filter((s) => s.id !== id))
    if (currentId === id) setCurrentId(null)
  }

  function updateNote(id, note) {
    setSaved((list) => list.map((s) => (s.id === id ? { ...s, note } : s)))
  }

  function newProduct() {
    setProduct(makeDefaultProduct())
    setCurrentId(null)
    notify('已清空，可建立新商品')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={saveCurrent}
          className="rounded-xl bg-teal-600 py-3 text-lg font-bold text-white active:scale-[0.97]"
        >
          💾 儲存此商品
        </button>
        <button
          type="button"
          onClick={newProduct}
          className="rounded-xl border-2 border-slate-200 bg-white py-3 text-lg font-bold text-slate-600 active:scale-[0.97]"
        >
          ＋ 新商品
        </button>
      </div>

      {flash && <p className="mt-2 text-center text-sm font-bold text-teal-700">{flash}</p>}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-3 flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-base font-bold text-slate-700"
      >
        <span>📂 已存商品（{saved.length}）</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {saved.length === 0 && (
            <p className="px-1 py-3 text-center text-sm text-slate-400">
              還沒有存任何商品。填好資料後按「儲存此商品」。
            </p>
          )}
          {saved.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border-2 p-3 ${
                item.id === currentId ? 'border-teal-400 bg-teal-50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-800">
                    {item.id === currentId && <span className="text-teal-600">● </span>}
                    {item.name || '（無品名）'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {item.brand} · {item.material} · {fmtDate(item.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => loadItem(item)}
                    className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-bold text-white active:scale-95"
                  >
                    載入
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="rounded-lg border-2 border-slate-200 px-3 py-2 text-sm font-bold text-slate-500 active:scale-95"
                  >
                    刪除
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={item.note || ''}
                onChange={(e) => updateNote(item.id, e.target.value)}
                placeholder="進度備註，例：已上架 / 待產圖"
                className="mt-2 w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-center text-xs text-slate-400">
        ※ 資料存在這支手機/瀏覽器本機，換裝置或清除瀏覽器資料會不見。
      </p>
    </section>
  )
}
