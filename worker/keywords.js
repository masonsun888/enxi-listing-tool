// /api/keywords：從員工貼入的「競品標題」萃取蝦皮搜尋關鍵字候選。
// 鐵律（後端硬驗、不靠 AI 自律）：每個候選必須是任一競品標題的 substring，比對不到就剔除。
// 純文字呼叫，與 analyze/copy 共用額度記帳與月上限。
import { callClaudeApi, addUsage, buildBudget, parseAnalysisText } from './analyze.js'

const KW_MAX_TOKENS = 1500
const CANDIDATE_LIMIT = 8 // 回傳前 N 個（依出現次數）
const MIN_KW_LEN = 2 // 單字（1 字）多半是雜訊，剔除
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' }

const KW_SYSTEM_PROMPT = `你是蝦皮關鍵字萃取引擎。使用者會給商品品名、（選填）現有標題、以及多條「競品標題」。任務：從競品標題中萃取「買家會用來搜尋這個商品的關鍵字候選」——品類詞、材質／屬性詞、規格詞、場景／用途詞。

【硬規則】
- 只能萃取競品標題「原文中實際連續出現過的字詞」，一個字都不能自己造、不能改寫、不能把分散的字拼起來（例：原文有「保溫杯」就給「保溫杯」；除非「不鏽鋼保溫杯」在原文連在一起出現，否則不准合成）。
- 排除品牌名、賣場名、型號、賣家暱稱。
- 每個候選盡量 2–6 字、是消費者真的會打進搜尋框的詞。
- 「現貨／免運／熱銷」這類流量詞：競品標題有才可列，沒有不要自己加。

只輸出合法 JSON（不要 markdown 圍欄、不要任何解說）：
{ "candidates": ["保溫杯", "316不鏽鋼", "大容量", "..."], "suggested": { "main": "保溫杯", "aux": ["316不鏽鋼", "大容量"] } }
candidates 給 8–15 個（後端會再過濾排序）；suggested.main 選最能代表品類、搜尋量最高的詞，aux 選 2–3 個補充屬性／場景詞。全部必須是競品標題出現過的字詞。`

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS })
}

function isStr(v) {
  return typeof v === 'string' && v.length > 0
}

// 把 body.competitorTitles 正規化成「非空字串陣列」（相容陣列或整段換行文字）。
export function normalizeTitles(input) {
  const arr = Array.isArray(input) ? input : typeof input === 'string' ? input.split('\n') : []
  return arr.map((t) => String(t || '').trim()).filter(Boolean)
}

// 鐵律驗證＋排序：候選必須是任一標題的 substring；統計出現在幾條（count）與哪幾條（sources）；
// 依 count 降冪、同分依關鍵字長度降冪（長詞通常更精準）取前 CANDIDATE_LIMIT。
export function rankKeywords(rawCandidates, titles) {
  const cleanTitles = normalizeTitles(titles)
  const seen = new Set()
  const out = []
  for (const raw of Array.isArray(rawCandidates) ? rawCandidates : []) {
    const kw = String(raw || '').trim()
    if (kw.length < MIN_KW_LEN || seen.has(kw)) continue
    const sources = []
    cleanTitles.forEach((t, i) => {
      if (t.includes(kw)) sources.push(i)
    })
    if (sources.length === 0) continue // 比對不到原文 → 剔除（鐵律）
    seen.add(kw)
    out.push({ keyword: kw, count: sources.length, sources })
  }
  out.sort((a, b) => b.count - a.count || [...b.keyword].length - [...a.keyword].length)
  return out.slice(0, CANDIDATE_LIMIT)
}

// suggested 也要過鐵律：main 無效就退回排序第一名；aux 只留通過驗證且在候選內的，上限 3。
export function sanitizeSuggested(suggested, ranked) {
  const valid = new Set(ranked.map((r) => r.keyword))
  const s = suggested && typeof suggested === 'object' ? suggested : {}
  let main = isStr(s.main) && valid.has(s.main.trim()) ? s.main.trim() : ''
  if (!main && ranked.length > 0) main = ranked[0].keyword
  const aux = []
  for (const a of Array.isArray(s.aux) ? s.aux : []) {
    const k = String(a || '').trim()
    if (valid.has(k) && k !== main && !aux.includes(k)) aux.push(k)
    if (aux.length >= 3) break
  }
  return { main, aux }
}

function buildUserText(body) {
  const titles = normalizeTitles(body.competitorTitles)
  const lines = [
    '【商品品名】' + (isStr(body.productName) ? body.productName : '（未填）'),
  ]
  if (isStr(body.currentTitle)) lines.push('【現有標題】' + body.currentTitle)
  lines.push('', '【競品標題（一行一條）】')
  titles.forEach((t, i) => lines.push(`${i + 1}. ${t}`))
  return lines.join('\n')
}

export async function handleKeywords(request, env) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: '後台尚未設定 AI 金鑰' }, 503)

  const budgetBefore = await buildBudget(env)
  if (budgetBefore.tracked && budgetBefore.usedTWD >= budgetBefore.limitTWD) {
    return json(
      {
        error: `本月 AI 額度已用完（NT$${budgetBefore.usedTWD} / NT$${budgetBefore.limitTWD}），下月 1 號自動重置`,
        budget: budgetBefore,
      },
      429,
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'body 必須是 JSON' }, 400)
  }

  const titles = normalizeTitles(body.competitorTitles)
  if (titles.length === 0) return json({ error: '缺少競品標題（一行貼一條）' }, 400)

  let spentInput = 0
  let spentOutput = 0
  let parsed = null
  try {
    const r = await callClaudeApi(env, {
      system: KW_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserText(body) }],
      maxTokens: KW_MAX_TOKENS,
    })
    spentInput += r.inputTokens
    spentOutput += r.outputTokens
    parsed = parseAnalysisText(r.text)
  } catch (err) {
    await addUsage(env, spentInput, spentOutput)
    return json({ error: 'AI 找關鍵字失敗：' + String(err && err.message ? err.message : err) }, 502)
  }

  await addUsage(env, spentInput, spentOutput)

  const ranked = rankKeywords(parsed && parsed.candidates, titles)
  if (ranked.length === 0) {
    return json(
      { error: 'competitors 裡沒抽到有效關鍵字，換幾條更相關的競品標題再試', budget: await buildBudget(env) },
      502,
    )
  }
  const suggested = sanitizeSuggested(parsed && parsed.suggested, ranked)
  return json({ candidates: ranked, suggested, budget: await buildBudget(env) })
}
