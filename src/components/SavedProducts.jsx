import { useEffect, useState } from 'react'
import { makeDefaultProduct } from '../defaults.js'

const KEY = 'enxi_saved_products'
const API = '/api/products'

function loadLocal() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function fmtDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function upsert(list, rec) {
  const without = list.filter((s) => s.id !== rec.id)
  return [rec, ...without].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

// 雲端 API：失敗時丟錯，呼叫端會退回本機模式。
async function apiList() {
  const r = await fetch(API, { headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error('api unavailable')
  const ct = r.headers.get('content-type') || ''
  if (!ct.includes('application/json')) throw new Error('not json')
  return (await r.json()).products || []
}
async function apiSave(record) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(record),
  })
  if (!r.ok) throw new Error('save failed')
  return (await r.json()).product
}
async function apiDelete(id) {
  const r = await fetch(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!r.ok) throw new Error('delete failed')
}

// 商品儲存：優先用雲端（多人共用、跨裝置）；雲端未連線時自動退回本機暫存。
export default function SavedProducts({ product, setProduct, currentId, setCurrentId }) {
  const [saved, setSaved] = useState([])
  const [mode, setMode] = useState('loading') // loading | cloud | local
  const [open, setOpen] = useState(false)
  const [flash, setFlash] = useState('')
  const [busy, setBusy] = useState(false)

  // 開啟時先試雲端，失敗就退回本機。
  useEffect(() => {
    let alive = true
    apiList()
      .then((products) => {
        if (!alive) return
        setSaved(products)
        setMode('cloud')
      })
      .catch(() => {
        if (!alive) return
        setSaved(loadLocal())
        setMode('local')
      })
    return () => {
      alive = false
    }
  }, [])

  // 本機鏡像：兩種模式都把清單寫進 localStorage（離線時也看得到上次的資料）。
  useEffect(() => {
    if (mode === 'loading') return
    localStorage.setItem(KEY, JSON.stringify(saved))
  }, [saved, mode])

  function notify(msg) {
    setFlash(msg)
    setTimeout(() => setFlash(''), 2000)
  }

  async function saveCurrent() {
    if (!product.name.trim()) {
      notify('請先填品名再儲存')
      return
    }
    const prev = saved.find((s) => s.id === currentId)
    const record = {
      id: currentId || undefined,
      brand: product.brand,
      name: product.name,
      size: product.size,
      material: product.material,
      colors: product.colors,
      note: prev ? prev.note || '' : '',
      updatedAt: Date.now(),
    }

    if (mode === 'cloud') {
      setBusy(true)
      try {
        const result = await apiSave(record)
        setSaved((list) => upsert(list, result))
        setCurrentId(result.id)
        notify(currentId ? '已更新（雲端）' : '已儲存（雲端）')
        setOpen(true)
        return
      } catch {
        setMode('local')
        notify('雲端連線失敗，改存本機')
      } finally {
        setBusy(false)
      }
    }

    const rec = { ...record, id: currentId || String(Date.now()) }
    setSaved((list) => upsert(list, rec))
    setCurrentId(rec.id)
    notify(currentId ? '已更新（本機）' : '已儲存（本機）')
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

  async function remove(id) {
    if (mode === 'cloud') {
      try {
        await apiDelete(id)
      } catch {
        notify('雲端刪除失敗')
        return
      }
    }
    setSaved((list) => list.filter((s) => s.id !== id))
    if (currentId === id) setCurrentId(null)
  }

  function setNoteLocal(id, note) {
    setSaved((list) => list.map((s) => (s.id === id ? { ...s, note } : s)))
  }

  function commitNote(id) {
    if (mode !== 'cloud') return
    const item = saved.find((s) => s.id === id)
    if (item) apiSave(item).catch(() => {})
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
          disabled={busy}
          className="rounded-xl bg-teal-600 py-3 text-lg font-bold text-white active:scale-[0.97] disabled:opacity-50"
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
          {mode === 'loading' && (
            <p className="px-1 py-3 text-center text-sm text-slate-400">讀取中…</p>
          )}
          {mode !== 'loading' && saved.length === 0 && (
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
                onChange={(e) => setNoteLocal(item.id, e.target.value)}
                onBlur={() => commitNote(item.id)}
                placeholder="進度備註，例：已上架 / 待產圖"
                className="mt-2 w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-center text-xs text-slate-400">
        {mode === 'cloud'
          ? '☁️ 雲端同步中：多人共用、換裝置也看得到。'
          : '📴 本機暫存中（雲端未連線）：資料只在這支手機。'}
      </p>
    </section>
  )
}
