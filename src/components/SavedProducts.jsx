import { useEffect, useRef, useState } from 'react'
import { makeDefaultProduct, makeEmptyWork, makeEmptyDone } from '../defaults.js'

const KEY = 'enxi_saved_products'
const API = '/api/products'

const STEPS = [
  ['title', '標題'],
  ['body', '內文'],
  ['image', '圖'],
  ['price', '定價'],
  ['listed', '上架'],
]

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

function authHeaders(password) {
  return password ? { 'x-app-password': password } : {}
}

// 雲端 API：失敗時丟錯，呼叫端會退回本機模式。
async function apiList(password) {
  const r = await fetch(API, { headers: { accept: 'application/json', ...authHeaders(password) } })
  if (!r.ok) throw new Error('api unavailable')
  const ct = r.headers.get('content-type') || ''
  if (!ct.includes('application/json')) throw new Error('not json')
  return (await r.json()).products || []
}
async function apiSave(record, password) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(password) },
    body: JSON.stringify(record),
  })
  if (!r.ok) throw new Error('save failed')
  return (await r.json()).product
}
async function apiDelete(id, password) {
  const r = await fetch(`${API}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(password),
  })
  if (!r.ok) throw new Error('delete failed')
}

// 商品儲存：優先用雲端（多人共用、跨裝置）；雲端未連線時自動退回本機暫存。
export default function SavedProducts({
  product,
  setProduct,
  work,
  setWork,
  currentId,
  setCurrentId,
  password,
  makeBlankProduct = makeDefaultProduct, // 「＋ 新商品」的空白預設（白牌九圖模式會換成白牌空白）
}) {
  const [saved, setSaved] = useState([])
  const [mode, setMode] = useState('loading') // loading | cloud | local
  const [open, setOpen] = useState(false)
  const [flash, setFlash] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    let alive = true
    apiList(password)
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
  }, [password])

  // 本機鏡像：兩種模式都把清單寫進 localStorage（離線時也看得到上次的資料）。
  useEffect(() => {
    if (mode === 'loading') return
    localStorage.setItem(KEY, JSON.stringify(saved))
  }, [saved, mode])

  function notify(msg) {
    setFlash(msg)
    setTimeout(() => setFlash(''), 2200)
  }

  // 寫入一筆（雲端優先；雲端失敗則退本機）。回傳實際存下的紀錄。
  async function persist(record) {
    if (mode === 'cloud') {
      try {
        const result = await apiSave(record, password)
        setSaved((list) => upsert(list, result))
        return result
      } catch {
        setMode('local')
        notify('雲端連線失敗，改存本機')
      }
    }
    const rec = { ...record, id: record.id || String(Date.now()) }
    setSaved((list) => upsert(list, rec))
    return rec
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
      done: prev ? prev.done || makeEmptyDone() : makeEmptyDone(),
      work,
      updatedAt: Date.now(),
    }
    setBusy(true)
    const result = await persist(record)
    setBusy(false)
    setCurrentId(result.id)
    notify(currentId ? '已更新' : '已儲存')
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
    setWork({ ...makeEmptyWork(), ...(item.work || {}) })
    setCurrentId(item.id)
    notify(`已載入：${item.name}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function remove(id) {
    if (mode === 'cloud') {
      try {
        await apiDelete(id, password)
      } catch {
        notify('雲端刪除失敗')
        return
      }
    }
    setSaved((list) => list.filter((s) => s.id !== id))
    if (currentId === id) setCurrentId(null)
  }

  function toggleStep(item, key) {
    const done = { ...makeEmptyDone(), ...(item.done || {}), [key]: !(item.done && item.done[key]) }
    const updated = { ...item, done, updatedAt: Date.now() }
    setSaved((list) => list.map((s) => (s.id === item.id ? updated : s)))
    if (mode === 'cloud') apiSave(updated, password).catch(() => {})
  }

  function setNoteLocal(id, note) {
    setSaved((list) => list.map((s) => (s.id === id ? { ...s, note } : s)))
  }
  function commitNote(id) {
    if (mode !== 'cloud') return
    const item = saved.find((s) => s.id === id)
    if (item) apiSave(item, password).catch(() => {})
  }

  function newProduct() {
    setProduct(makeBlankProduct())
    setWork(makeEmptyWork())
    setCurrentId(null)
    notify('已清空，可建立新商品')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(saved, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `enxi-products-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importJSON(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    try {
      const arr = JSON.parse(await file.text())
      if (!Array.isArray(arr)) throw new Error('格式不對')
      for (const raw of arr) {
        const rec = {
          ...raw,
          id: raw.id || String(Date.now() + Math.random()),
          updatedAt: raw.updatedAt || Date.now(),
        }
        if (mode === 'cloud') await apiSave(rec, password)
        else setSaved((list) => upsert(list, rec))
      }
      if (mode === 'cloud') setSaved(await apiList(password))
      setOpen(true)
      notify(`已匯入 ${arr.length} 筆`)
    } catch (err) {
      notify('匯入失敗：' + (err.message || '檔案錯誤'))
    }
    if (fileRef.current) fileRef.current.value = ''
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportJSON}
              className="flex-1 rounded-lg border-2 border-slate-200 py-2 text-sm font-bold text-slate-600 active:scale-95"
            >
              ⬇️ 匯出備份
            </button>
            <button
              type="button"
              onClick={() => fileRef.current && fileRef.current.click()}
              className="flex-1 rounded-lg border-2 border-slate-200 py-2 text-sm font-bold text-slate-600 active:scale-95"
            >
              ⬆️ 匯入
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={importJSON}
              className="hidden"
            />
          </div>

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

              {/* 進度勾選 */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {STEPS.map(([key, label]) => {
                  const on = item.done && item.done[key]
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleStep(item, key)}
                      className={`rounded-full px-3 py-1 text-xs font-bold active:scale-95 ${
                        on
                          ? 'bg-emerald-500 text-white'
                          : 'border-2 border-slate-200 bg-white text-slate-400'
                      }`}
                    >
                      {on ? '✓ ' : ''}
                      {label}
                    </button>
                  )
                })}
              </div>

              <input
                type="text"
                value={item.note || ''}
                onChange={(e) => setNoteLocal(item.id, e.target.value)}
                onBlur={() => commitNote(item.id)}
                placeholder="備註（選填）"
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
