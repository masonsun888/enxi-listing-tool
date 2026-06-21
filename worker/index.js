// 恩希 SKU 健康管理系統 — 最小版 Worker。
// 目的：先打通「開發 → 部署 → 手機開得了」這條管線。
//
// 目前只做兩件事：
// 1. 把所有請求交給 Static Assets（public/ 裡的首頁）。
// 2. 預留 /api/health：之後接 D1（env.DB）做功能用，現在先回報綁定狀態。

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // 健康檢查 / 確認 D1 綁定是否成功（之後做功能會用到）。
    if (url.pathname === '/api/health') {
      return Response.json({
        ok: true,
        service: '恩希 SKU 健康管理系統',
        d1Bound: Boolean(env.DB),
        time: new Date().toISOString(),
      })
    }

    // 其餘交給靜態首頁。
    return env.ASSETS.fetch(request)
  },
}
