// Hero A/B 版本的純邏輯（可單元測試）：狀態機＋上架天數。
// variant = { id, prompt, strategySnapshot, status:'live'|'testing'|'archived', createdAt }

export const VARIANT_STATUS = { LIVE: 'live', TESTING: 'testing', ARCHIVED: 'archived' }
export const AB_REMIND_DAYS = 14 // 現役 Hero 超過這天數 → 軟提醒可以打擂台

// 標某個 variant 為現役（live）：同一商品同時只能有 1 個 live，原本的 live 自動轉 archived。
export function setActiveVariant(variants, id) {
  const list = Array.isArray(variants) ? variants : []
  return list.map((v) => {
    if (v.id === id) return { ...v, status: VARIANT_STATUS.LIVE }
    if (v.status === VARIANT_STATUS.LIVE) return { ...v, status: VARIANT_STATUS.ARCHIVED }
    return v
  })
}

// 上架天數（今天 - createdAt），無效輸入回 null。now 可注入方便測試。
export function daysSince(createdAt, now = Date.now()) {
  const t = Number(createdAt)
  if (!Number.isFinite(t) || t <= 0) return null
  return Math.max(0, Math.floor((now - t) / 86400000))
}

// 現役版本是否該提醒打擂台：有 live、且上架 > AB_REMIND_DAYS 天、且目前只有 1 個版本。
export function shouldRemindAB(variants, now = Date.now()) {
  const list = Array.isArray(variants) ? variants : []
  if (list.length !== 1) return false
  const live = list.find((v) => v.status === VARIANT_STATUS.LIVE)
  if (!live) return false
  const d = daysSince(live.createdAt, now)
  return d !== null && d > AB_REMIND_DAYS
}

const STATUS_LABEL = {
  live: '🟢 現役',
  testing: '🧪 測試中',
  archived: '📦 已封存',
}
export function statusLabel(status) {
  return STATUS_LABEL[status] || status
}
