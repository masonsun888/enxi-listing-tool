// 白牌九圖模板引擎：純函式、零 AI。
// 把 /api/analyze 回來的分析卡＋人填的商品資料，組成九張製圖 prompt 工作單（＋選項圖）。
// 連貫性靠同一組 hex：palettePick 決定用 palette 或 palette_alt，九張同步注入同一組色碼。
import { formatProduct, buildSpecRows, buildSpecImagePrompt } from './prompts.js'

// 每張卡片：slot 序號、label 圖種名、materialsHint 要給 GPT 的素材、prompt 全文、textChecklist 逐字核對清單。
// warning（選填）：卡片上的紅字提醒。

const SCENE_ANGLES = [
  '中景視角，商品自然擺放於場景中',
  '使用中的近距特寫，呈現手部與商品互動',
  '45 度生活感俯拍',
]

// 主標「上行｜下行」轉成給 GPT 的雙行語意描述。
function describeMainTitle(raw) {
  const parts = String(raw).split('｜').map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 2) return `雙行排版，上行「${parts[0]}」、下行「${parts[1]}」`
  return `「${parts[0] || raw}」`
}

function buildHeroPrompt(product, v) {
  const gradientClause =
    Array.isArray(v.FILLG) && v.FILLG.length === 2
      ? `，做 ${v.FILLG[0]} → ${v.FILLG[1]} 的金屬漸層`
      : ''
  return `【商品主圖設計 — 蝦皮／MOMO 爆款風格】

請參考我另外提供的「標準版型風格圖」。只保留參考圖的「整體排版結構、視覺層級、字體風格、廣告氛圍、電商轉換邏輯」，不得直接複製參考商品，商品需完全換成我這次上傳的實拍商品。

【商品資料】
${formatProduct(product)}

【輸入區】
・商品圖片：我上傳的實拍照（請完整保留真實外觀、材質、顏色，不得變形裁切）
・主標題：${v.MAIN_TITLE}
・副標語：${v.SUB}

【版面結構】
・主商品：置於畫面右側，佔 60~70%，完整呈現、不裁切、不變形、高解析、真實質感。
・情境圖：左側放 1 個使用情境小圖，展示實際使用方式（場景：${v.SCENES[0]}）。
・主標題：畫面上方、雙行排版、大型藝術字、活潑可愛的圓潤泡泡字、3D 厚度、白色粗描邊、深色陰影（陰影色 ${v.SHADOW}），字體填色：${v.FILL}${gradientClause}。
・副標語：主標下方，筆刷底圖（筆刷底色 ${v.ACCENT}、白色字），一句話講利益點。
・賣點區：只保留 1 個最重要賣點：「${v.SP[0].title}」，大 ICON、白底圓角框、金色描邊。
・情境標語：主商品附近，藝術字、${v.ACCENT} 色、白色描邊，強化購買動機（文字：${v.SLOGAN}）。

【背景】${v.BG1} → ${v.BG2} 柔和漸層，背景柔焦、高級生活感、商品清晰、背景不搶主體、電商攝影棚等級、自然景深。
【光線】右上暖陽光暈 Sunburst Glow、高亮度、柔和陰影、產品邊緣高光。

【禁止事項】不要品牌 LOGO、不要浮水印、不要多餘 ICON、不要複雜資訊框、不要價格、不要促銷貼紙、不要台灣出貨徽章、不要遮擋商品、不要錯字。

【輸出要求】繁體中文、蝦皮爆款風格、MOMO 商品頁風格、高轉換率電商主圖、Commercial Advertising Design、Ultra Realistic Product Photography、1:1 Square、4K Ultra HD、商品絕對清晰、背景柔焦、真實攝影感。`
}

function buildIntroPrompt(sp, v) {
  return `以我上傳的實拍照片為準，完整保留商品外觀、材質、顏色（不重畫商品），製作蝦皮商品內頁的「單一賣點介紹圖」。

・賣點主標（圓潤藝術字、填色 ${v.FILL}、白色描邊、深色陰影 ${v.SHADOW}、放畫面上方、字級大但小於主圖主標）：${sp.title}
・說明小字（一句、深灰色、放主標正下方）：${sp.desc}
・構圖：商品或該賣點對應的功能部位特寫，佔畫面 60~70%；只呈現這一個賣點，不放其他賣點、不放雜訊。
・背景：${v.BGS1} → ${v.BGS2} 柔和漸層，乾淨留白、柔和棚拍光、商品邊緣清晰有高光。

繁體中文、必須正確無錯字、正方形 1:1、4K、高轉換率電商內頁圖。`
}

function buildNineScenePrompt(product, scene, angle) {
  const name = product.name || '【品名】'
  return `以我上傳的實拍為商品參考，保持商品外觀、材質、顏色一致（不重畫商品）。將${name}自然放入「${scene}」的生活情境，${angle}。溫暖自然光、真實居家質感、淺景深，商品為視覺焦點，畫面中不出現任何文字。正方形 1:1。`
}

function buildComparePrompt(ba, v) {
  return `以我上傳的實拍為商品參考，保持商品外觀一致（不重畫商品），製作「使用前 vs 使用後」對比圖，左右分割。

・左半「使用前」：${ba.before_scene}。色調偏灰暗、低飽和，傳達困擾感；此側「不出現」本商品。左上角小標「使用前」，左側短文案（≤12 字、白色字、深色底框）：${ba.before_copy}
・右半「使用後」：${ba.after_scene}。明亮氛圍，背景帶 ${v.BG1} 色調，本商品清楚入鏡、使用中狀態。右上角小標「使用後」，右側短文案（${v.ACCENT} 色藝術字、白色描邊）：${ba.after_copy}
・中間：由左指向右的箭頭（${v.ACCENT} 色、白色描邊）。

【硬規則】畫面中只能出現本商品，嚴禁出現任何其他品牌、「市售款」「一般款」或任何虛構的比較商品；嚴禁出現任何數據、百分比或檢測數字；嚴禁貶低性字眼。繁體中文、必須正確無錯字、正方形 1:1。`
}

// 選項圖：沿用現有選項圖模板原文，{{colors}} 換成單一顏色（白牌不放 logo）。
function buildOptionPrompt(color) {
  return `以我上傳的${color}實拍照片為準，商品外觀與顏色完全保留。去背，純白背景，正方形1:1，電商選項展示用。不得更動商品顏色。`
}

// buildNine(product, specs, analysis, palettePick, customMainTitle?, mainTitlePick?)
//   → { cards: Card[9], optionCards: Card[N] }
export function buildNine(product, specs, analysis, palettePick = 'main', customMainTitle = '', mainTitlePick = 0) {
  const pal = palettePick === 'alt' ? analysis.palette_alt : analysis.palette
  const copy = analysis.copy

  const titleOptions = copy.main_title_options || []
  const rawTitle =
    String(customMainTitle || '').trim() || titleOptions[mainTitlePick] || titleOptions[0] || '（未填主標題）'
  const titleParts = rawTitle.split('｜').map((s) => s.trim()).filter(Boolean)

  // 共用注入值
  const v = {
    BG1: pal.bg_gradient[0],
    BG2: pal.bg_gradient[1],
    BGS1: pal.bg_soft[0],
    BGS2: pal.bg_soft[1],
    FILL: pal.title_fill,
    FILLG: pal.title_fill_gradient || null,
    SHADOW: pal.title_shadow,
    ACCENT: pal.accent,
    MAIN_TITLE: describeMainTitle(rawTitle),
    SUB: copy.sub_title,
    SLOGAN: copy.hero_slogan,
    SP: copy.selling_points,
    SCENES: copy.scenes,
    BA: copy.before_after,
  }

  const cards = []

  // 槽 1｜Hero 爆款主圖
  cards.push({
    slot: 1,
    label: 'Hero 爆款主圖',
    materialsHint: '商品實拍主圖＋標準版型參考圖（本卡片可下載）',
    prompt: buildHeroPrompt(product, v),
    textChecklist: [...titleParts.map((t, i) => `主標${i === 0 ? '上行' : '下行'}：${t}`), `副標：${v.SUB}`, `賣點：${v.SP[0].title}`, `情境標語：${v.SLOGAN}`],
  })

  // 槽 2–4｜介紹圖 ×3（一張一賣點）
  v.SP.forEach((sp, i) => {
    cards.push({
      slot: 2 + i,
      label: `賣點介紹圖 ${i + 1}`,
      materialsHint: '商品實拍圖（可含這個賣點部位的特寫）',
      prompt: buildIntroPrompt(sp, v),
      textChecklist: [`賣點主標：${sp.title}`, `說明小字：${sp.desc}`],
    })
  })

  // 槽 5–7｜情境圖 ×3（三張構圖角度不同）
  v.SCENES.forEach((scene, i) => {
    cards.push({
      slot: 5 + i,
      label: `情境圖 ${i + 1}`,
      materialsHint: '商品實拍圖',
      prompt: buildNineScenePrompt(product, scene, SCENE_ANGLES[i]),
      textChecklist: [],
      warning: '本張不應出現任何文字，看到字＝重生',
    })
  })

  // 槽 8｜尺寸規格圖（數字全部來自人填 specs，沿用現有規格圖 prompt，僅加配色呼應句）
  const specRows = buildSpecRows(product, specs)
  cards.push({
    slot: 8,
    label: '尺寸規格圖',
    materialsHint: '白底商品圖',
    prompt:
      buildSpecImagePrompt(product, specs) +
      `\n\n【配色呼應】規格表標題與分隔線條使用 ${v.ACCENT} 色，與整套圖視覺呼應；底色維持白底不變。`,
    textChecklist: specRows,
    warning: '⚠️ 數字錯一個字＝客訴，逐字核對',
  })

  // 槽 9｜比較圖（使用前後）
  cards.push({
    slot: 9,
    label: '使用前後比較圖',
    materialsHint: '商品實拍圖',
    prompt: buildComparePrompt(v.BA, v),
    textChecklist: ['小標：使用前', '小標：使用後', `左側文案：${v.BA.before_copy}`, `右側文案：${v.BA.after_copy}`],
  })

  // 選項圖 ×N（不佔九格）：依商品顏色每色一張
  const colors = Array.isArray(product.colors) ? product.colors : []
  const optionCards = colors.map((color, i) => ({
    slot: `option-${i}`,
    label: `選項圖｜${color}`,
    materialsHint: `${color} 商品實拍圖`,
    prompt: buildOptionPrompt(color),
    textChecklist: [],
  }))

  return { cards, optionCards }
}
