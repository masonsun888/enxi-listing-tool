// Cloudflare Worker：同時服務前端靜態檔（env.ASSETS）與 /api 商品儲存（env.PRODUCTS KV）。
// 沒有設定 KV 綁定時，/api 會回 503，前端會自動退回「本機暫存」模式。
// 有設定 env.APP_PASSWORD 時，/api 需帶 x-app-password 標頭，否則回 401（前端會跳密碼鎖）。

import { handleAnalyze, buildBudget } from './analyze.js'
import { handleCopy } from './copy.js'
import { handleKeywords } from './keywords.js'

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' }
const PREFIX = 'product:'

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS })
}

function authed(request, env) {
  if (!env.APP_PASSWORD) return true // 未設定密碼 = 不鎖
  return request.headers.get('x-app-password') === env.APP_PASSWORD
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url)
      } catch (err) {
        return json({ error: String(err && err.message ? err.message : err) }, 500)
      }
    }
    return env.ASSETS.fetch(request)
  },
}

async function handleApi(request, env, url) {
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401)

  // /api/analyze：新品九圖的 AI 素材分析（不需要 KV）
  if (url.pathname === '/api/analyze' && request.method === 'POST') {
    return handleAnalyze(request, env)
  }

  // /api/copy：一鍵上架文案／優化舊品標題（純文字呼叫，不需要 KV）
  if (url.pathname === '/api/copy' && request.method === 'POST') {
    return handleCopy(request, env)
  }

  // /api/keywords：優化舊品·卡1 從競品標題萃取關鍵字候選（純文字呼叫，不需要 KV）
  if (url.pathname === '/api/keywords' && request.method === 'POST') {
    return handleKeywords(request, env)
  }

  // /api/usage：本月 AI 分析額度（前端進度條用）
  if (url.pathname === '/api/usage' && request.method === 'GET') {
    return json({ budget: await buildBudget(env) })
  }

  if (!env.PRODUCTS) return json({ error: 'KV 尚未設定' }, 503)

  // /api/products
  if (url.pathname === '/api/products') {
    if (request.method === 'GET') {
      const list = await env.PRODUCTS.list({ prefix: PREFIX })
      const items = await Promise.all(
        list.keys.map(async (k) => {
          const v = await env.PRODUCTS.get(k.name)
          return v ? JSON.parse(v) : null
        }),
      )
      const products = items
        .filter(Boolean)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      return json({ products })
    }

    if (request.method === 'POST') {
      const body = await request.json()
      const id = body.id || crypto.randomUUID()
      const record = {
        id,
        brand: body.brand || '',
        name: body.name || '',
        size: body.size || '',
        material: body.material || '',
        colors: Array.isArray(body.colors) ? body.colors : [],
        note: body.note || '',
        done: body.done || null,
        work: body.work || null,
        updatedAt: Date.now(),
      }
      await env.PRODUCTS.put(PREFIX + id, JSON.stringify(record))
      return json({ product: record })
    }
  }

  // /api/products/:id
  const m = url.pathname.match(/^\/api\/products\/(.+)$/)
  if (m && request.method === 'DELETE') {
    const id = decodeURIComponent(m[1])
    await env.PRODUCTS.delete(PREFIX + id)
    return json({ ok: true })
  }

  return json({ error: 'Not found' }, 404)
}
