import test from 'node:test'
import assert from 'node:assert/strict'
import { setActiveVariant, daysSince, shouldRemindAB, VARIANT_STATUS, AB_REMIND_DAYS } from '../src/heroVariants.js'

test('setActiveVariant：標 live 時舊 live 自動 archived、同時只有 1 個 live', () => {
  const vs = [
    { id: 'a', status: 'live' },
    { id: 'b', status: 'testing' },
    { id: 'c', status: 'archived' },
  ]
  const next = setActiveVariant(vs, 'b')
  assert.equal(next.find((v) => v.id === 'b').status, VARIANT_STATUS.LIVE)
  assert.equal(next.find((v) => v.id === 'a').status, VARIANT_STATUS.ARCHIVED) // 舊 live 轉封存
  assert.equal(next.find((v) => v.id === 'c').status, 'archived') // 其他不動
  assert.equal(next.filter((v) => v.status === 'live').length, 1) // 只有 1 個 live
})

test('daysSince：上架天數，無效輸入回 null', () => {
  const now = 1000 * 86400000 // 第 1000 天
  assert.equal(daysSince((1000 - 14) * 86400000, now), 14)
  assert.equal(daysSince(now, now), 0)
  assert.equal(daysSince(null), null)
  assert.equal(daysSince(0), null)
})

test('shouldRemindAB：只有 1 個 live 且上架 > 14 天才提醒', () => {
  const now = 1000 * 86400000
  const old = (1000 - 20) * 86400000
  const fresh = (1000 - 5) * 86400000
  assert.equal(shouldRemindAB([{ id: 'a', status: 'live', createdAt: old }], now), true)
  assert.equal(shouldRemindAB([{ id: 'a', status: 'live', createdAt: fresh }], now), false) // 太新
  assert.equal(
    shouldRemindAB([{ id: 'a', status: 'live', createdAt: old }, { id: 'b', status: 'testing', createdAt: old }], now),
    false,
  ) // 已有 2 版就不提醒（去打擂台了）
  assert.equal(shouldRemindAB([], now), false)
  assert.ok(AB_REMIND_DAYS === 14)
})
