import { useState } from 'react'

// 共用密碼鎖：後端有設 APP_PASSWORD 時才會出現。
export default function LockScreen({ onUnlock }) {
  const [pw, setPw] = useState('')

  function submit(e) {
    e.preventDefault()
    if (pw.trim()) onUnlock(pw.trim())
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <form onSubmit={submit} className="w-full max-w-[360px] rounded-2xl bg-white p-6 shadow">
        <h1 className="text-center text-xl font-extrabold text-teal-700">恩希上架工具</h1>
        <p className="mt-1 mb-4 text-center text-sm text-slate-500">請輸入共用密碼</p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="密碼"
          autoFocus
          className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-lg text-slate-800 focus:border-teal-500 focus:outline-none"
        />
        <button
          type="submit"
          className="mt-3 w-full rounded-2xl bg-teal-600 py-4 text-lg font-bold text-white active:scale-[0.98]"
        >
          進入
        </button>
        <p className="mt-3 text-center text-xs text-slate-400">密碼錯誤會再次要求輸入。</p>
      </form>
    </div>
  )
}
