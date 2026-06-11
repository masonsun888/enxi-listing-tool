// 品牌與材質選項（供 ProductForm 與 prompt 共用）
export const BRANDS = ['樂扣樂扣', '珍珠金屬', '白牌']
export const MATERIALS = ['不鏽鋼', '鐵', 'PP塑膠', '塑膠', '塑料', '玻璃', '矽膠', '其他']

export const PEARL_BRAND = '珍珠金屬'
export const LOCKNLOCK_BRAND = '樂扣樂扣'

// 把商品基本資料整理成一段人類可讀的文字，塞進各個 prompt 裡。
export function formatProduct(product) {
  const colors = product.colors.length > 0 ? product.colors.join('、') : '（未填）'
  return [
    `品牌：${product.brand || '（未填）'}`,
    `品名：${product.name || '（未填）'}`,
    `容量/尺寸：${product.size || '（未填）'}`,
    `材質：${product.material || '（未填）'}`,
    `顏色：${colors}`,
  ].join('\n')
}

// 分頁1：標題
const TITLE_SYSTEM_PROMPT = `你是蝦皮與 Momo 的上架標題優化助手。依據我提供的商品資料和競品標題，產出兩個標題。
硬規則：
- 只能使用商品資料中的真實資訊，禁止編造任何規格或功能。
- 從競品標題只萃取「通用品類關鍵字」（例：保溫杯、316不鏽鋼、大容量、密封）。
- 嚴禁抄入競品的品牌名、商標、賣場名、型號。
- 商品資料中「我自己的品牌」（如樂扣）可以保留使用。
蝦皮標題：高搜尋量關鍵字放最前面，關鍵字密度優先，可較長。
Momo 標題：嚴格 ≤ 60 字元（中文 1 字 = 1 字元，含空格）。
輸出格式：
【蝦皮標題】……
【Momo標題（共 XX 字元）】……`

export function buildTitlePrompt(product, competitorTitles) {
  const competitors = competitorTitles.trim() || '（未提供競品標題）'
  const brandRule =
    product.brand === LOCKNLOCK_BRAND
      ? '\n【品牌規則】本商品為樂扣樂扣，蝦皮標題與 Momo 標題的「開頭」一律以「樂扣樂扣 LocknLock」開始，其餘規則不變。'
      : ''
  return [
    TITLE_SYSTEM_PROMPT + brandRule,
    '',
    '【商品資料】',
    formatProduct(product),
    '',
    '【競品標題】',
    competitors,
  ].join('\n')
}

// 分頁2：內文（直接輸出可貼給客人的成品內文）
const BODY_SYSTEM_PROMPT = `你是蝦皮商品文案優化助手。請依據我提供的「真實商品資料」，產出「直接可以貼給客人看」的商品內文。

【硬規則】
- 商品的規格、容量、尺寸、材質、功能，只能使用我提供的真實資料，禁止編造或誇大；我沒提供的就不要寫。
- 語氣像人話、活潑親切，可適度用 emoji，但不要硬堆關鍵字。
- 重要：輸出是要直接貼給客人看的成品。**絕對不要出現任何給內部看的字眼或括號標註**，例如不要寫「權重內文」「搜尋用」「爆款文案」「區塊一／二」「風格參考」「(這段給內部)」等。客人看到的只能是乾淨的商品介紹本身。

請依序輸出以下內容（標題就用下面這幾個中文小標即可，不要再加其他內部註解）：

【商品介紹】
先一段 80–150 字的商品介紹，前 30 字內自然帶入 2–3 個核心關鍵字，結尾一句行動呼籲。

接著是「痛點 → 解決」情境短文 2–3 段，每段用一個 emoji 開頭：先點出使用者的煩惱，再帶出本商品如何解決（只能根據真實賣點）。

【商品規格】
用條列整理我提供的材質 / 容量 / 尺寸 / 顏色等真實資料（我沒給的項目就不要列）。

【購買須知】
三個小段，用親切口吻精簡改寫：
・現貨即時補：台灣現貨、出貨前人工檢查、物流受損會負責處理。
・開箱請錄影：請錄影開箱，方便數量／顏色／款式問題快速處理。
・小提醒：工藝商品可能有微小尺寸誤差與螢幕色差，完美主義者請斟酌下單。

最後一行放 6–10 個 hashtag（以 # 開頭，涵蓋品類、材質、容量、使用情境）。

語氣與排版可參考（內容請全部換成本商品真實資料）：
😩 每天都要跑好幾趟飲水機補水，工作節奏一直被打斷⋯這款大容量直接幫你省下補水時間，裝滿一次撐到下班！

輸出：只給上述成品內文，不要任何額外解釋或內部說明。`

export function buildBodyPrompt(product) {
  return [BODY_SYSTEM_PROMPT, '', '【商品資料】', formatProduct(product)].join('\n')
}

// 分頁3：製圖
export const IMAGE_TYPES = [
  { key: 'main', label: '主圖' },
  { key: 'option', label: '選項圖' },
  { key: 'spec', label: '規格圖' },
  { key: 'scene', label: '情境圖' },
  { key: 'howto', label: '使用說明' },
]

// 情境圖場景庫（每次產生隨機換一個）
export const SCENE_OPTIONS = [
  '溫馨居家辦公桌',
  '明亮廚房中島',
  '戶外野餐草地',
  '健身房運動場景',
  '客廳沙發旁的小桌',
  '露營野營折疊桌',
  '車內飲料杯架',
  '咖啡廳木質桌面',
]

// 使用說明版型庫（每次產生隨機換一個）
export const HOWTO_OPTIONS = [
  '橫式 3 格步驟圖解（由左到右）',
  '直式步驟條列圖解（由上到下）',
  '圓圈數字 1-2-3-4 步驟排版',
  '商品特寫 + 箭頭指引功能標示',
  '使用前後對比圖',
]

// 各圖種共用的品牌呈現邏輯（樂扣樂扣標準字／珍珠金屬 logo 右上角）。
function brandInstruction(brand) {
  if (brand === LOCKNLOCK_BRAND)
    return '\n【品牌】在畫面上方放上乾淨的「樂扣樂扣 LocknLock」標準字（純文字、不使用 logo 圖案），低調專業。'
  if (brand === PEARL_BRAND)
    return '\n【品牌】我會另外提供一張品牌 logo 圖，請將「珍珠金屬 PEARL LIFE」logo 固定放在圖片「右上角」，清晰、比例自然、不變形、不遮擋商品。'
  return ''
}

// 珍珠金屬：每一張 AI 圖都要放上品牌 logo（固定右上角）。
function pearlLogoNote(brand) {
  if (brand !== PEARL_BRAND) return ''
  return '\n本商品為「珍珠金屬（PEARL LIFE／パール金属）」品牌，我會另外提供一張品牌 logo 圖，請將「珍珠金屬 PEARL LIFE」logo 固定放在圖片「右上角」，清晰、比例自然、不變形、不可遮擋商品。'
}

// 規格圖不經 AI，回傳一段可複製的文字標籤供排版用。
export function buildSpecLabel(product) {
  return [
    `品名：${product.name || '（未填）'}`,
    `容量/尺寸：${product.size || '（未填）'}`,
    `材質：${product.material || '（未填）'}`,
  ].join('\n')
}

// 白牌（非珍珠金屬、非樂扣）主圖：蝦皮爆款風格的詳細設計指令。
function buildBaoKuanMainPrompt(product, { mainTitle = '', subTitle = '' } = {}) {
  const title = mainTitle.trim() || '【請填入主標題】'
  const sub = subTitle.trim()
  return `【商品主圖設計 — 蝦皮／MOMO 爆款風格】

請參考我另外提供的版型風格圖。只保留參考圖的「整體排版結構、視覺層級、字體風格、廣告氛圍、電商轉換邏輯」，不得直接複製參考商品，商品需完全換成我這次上傳的實拍商品。

【商品資料】
${formatProduct(product)}

【輸入區】
・商品圖片：我上傳的實拍照（請完整保留真實外觀、材質、顏色，不得變形裁切）
・主標題：${title}
・副標語：${sub || '（AI 依商品自動生成）'}

【AI 自動分析】依商品自動判斷：商品類型、使用情境、材質特色、核心痛點、主要賣點、目標客群，並自動生成：${sub ? '情境文案、功能文案、Callout 標題（副標語用我上面指定的）' : '副標語、情境文案、功能文案、Callout 標題'}。

【版面結構】
・主商品：置於畫面右側，佔 60~70%，完整呈現、不裁切、不變形、高解析、真實質感。
・情境圖：左側放 1 個使用情境小圖，展示實際使用方式。
・主標題：畫面上方、雙行排版、大型藝術字、活潑可愛的圓潤泡泡字、3D 厚度、白色粗描邊、深色陰影、金色發光，依商品類型自動配色（白牌走蝦皮爆款活潑風，泡泡字 OK）。
・副標語：主標下方，筆刷底圖，一句話講利益點（例：輕鬆洗到底／秒收納不佔位）。
・賣點區：只保留 1 個最重要賣點，大 ICON、白底圓角框、金色描邊，依商品自動生成（例：食品級矽膠／304不鏽鋼／防水防塵）。
・情境標語：主商品附近，藝術字，紅或橘色系、白色描邊，強化購買動機（例：一掛即用！／超省空間！）。

【背景】依商品自動生成最適合場景，背景柔焦、高級生活感、商品清晰、背景不搶主體、電商攝影棚等級、自然景深。
【光線】右上暖陽光暈 Sunburst Glow、高亮度、柔和陰影、產品邊緣高光。
【配色規則】清潔用品→藍+橘；收納用品→奶油+木質；汽機車用品→黑+紅+金；廚房用品→黃+橘；衛浴用品→藍+白；高級用品→香檳金+深咖啡（AI 依商品自動判斷）。

【禁止事項】不要品牌 LOGO、不要浮水印、不要多餘 ICON、不要複雜資訊框、不要價格、不要促銷貼紙、不要台灣出貨徽章、不要遮擋商品、不要錯字。

【輸出要求】繁體中文、蝦皮爆款風格、MOMO 商品頁風格、高轉換率電商主圖、Commercial Advertising Design、Ultra Realistic Product Photography、1:1 Square、4K Ultra HD、商品絕對清晰、背景柔焦、真實攝影感。`
}

// 珍珠金屬 / 樂扣樂扣 主圖：品牌信任感的高質感商品圖（品牌置頂＋色彩學背景＋精緻藝術字）。
function buildCleanMainPrompt(product, { sellingPoints = '', mainTitle = '', subTitle = '' } = {}) {
  const title = mainTitle.trim() || '（請依商品特性自動生成一句吸睛的短主標題）'
  const sub = subTitle.trim()
  const points = sellingPoints.trim() || '（請依商品特性自動生成 2–3 個賣點）'

  // 品牌呈現：樂扣樂扣＝純標準字置頂（不使用 logo）；珍珠金屬＝上傳的 logo 放右上角。
  let brandTop
  if (product.brand === LOCKNLOCK_BRAND) {
    brandTop =
      '在畫面「最上方、主標題的上面」放上「樂扣樂扣」品牌名，用乾淨專業的標準字（不是廉價泡泡字）。樂扣樂扣不使用任何 logo 圖案，純文字呈現即可，一眼可見、建立品牌信任感。'
  } else if (product.brand === PEARL_BRAND) {
    brandTop =
      '我會提供商品主圖素材 + 一張品牌 logo 圖。請把「珍珠金屬 PEARL LIFE」logo 固定放在畫面「右上角」，清晰、比例自然、不變形、不遮擋商品，建立品牌信任感。'
  } else {
    brandTop = '在畫面最上方、主標題之上，放上清楚專業的品牌標誌字樣。'
  }

  const subLine = sub
    ? `‧ 副標題：放在主標題正下方，字級中等（明顯小於主標題、但大於賣點小標），與主標題風格一致：\n${sub}\n`
    : ''

  return `以我上傳的實拍照片為準，做成「有品牌信任感」的高質感電商主圖。

【整體風格】像品牌官方旗艦店／專櫃的形象主圖：乾淨、留白充足、構圖簡潔、有高級感與信任感。請避免廉價淘寶風——不要過度花俏的彩色泡泡字、不要雜亂貼紙與過多裝飾、不要把畫面塞滿；配色克制、統一、有質感。

【品牌】${brandTop}

【商品本體】保留商品真實造型、材質、設計與商品上原有的標誌與印刷文字，不得移除、塗改或捏造不存在的特徵。允許做基礎調色與簡單修圖：修正曝光、白平衡、偏色、雜訊、輕微刮痕、髒污與反光，讓商品乾淨專業；但不可改變商品的真實顏色識別與造型。

【背景】不要用純白背景。請依商品主色，用色彩學挑一個能凸顯商品、與商品有明顯對比的柔和高級背景色（白色或淺色商品請用低彩度的莫蘭迪色、淺灰藍、奶油、霧粉等中低明度色；可呼應商品上的點綴色）。柔和棚拍打光，商品底部加自然柔和陰影並保留邊緣高光，確保商品邊緣清晰、不會糊進背景。

【構圖】商品完整置中、佔畫面約 70–80%，正方形 1:1，留白足夠、不雜亂。

【文字｜全部繁體中文、必須正確無錯字、精緻品牌級字體（非廉價泡泡字）、需有清楚大小階層】
‧ 主標題：放畫面上方、不與品牌標誌重疊，字級最大、最醒目：
${title}
${subLine}‧ 賣點小標：用 2–3 個「明顯小於主標題」的精簡 icon callout 呈現，風格統一、分散在留白區、不可遮擋商品、不可大過主標題：
${points}`
}

// 樂扣樂扣 主圖：官方旗艦店／momo 目錄風（乾淨白底、專業棚拍、文字極簡）。
function buildLocknlockOfficialPrompt(product, { sellingPoints = '', mainTitle = '', subTitle = '' } = {}) {
  const texts = []
  if (mainTitle.trim()) texts.push(`主標題：${mainTitle.trim()}`)
  if (subTitle.trim()) texts.push(`副標題：${subTitle.trim()}`)
  if (sellingPoints.trim())
    texts.push(`賣點（最多 2–3 個小字）：${sellingPoints.trim().replace(/\n/g, '、')}`)

  const textBlock =
    texts.length > 0
      ? `\n\n【文字｜選配，保持官方乾淨感】只加入以下我指定的文字，用簡約細緻的標準字（小而精緻、絕非花俏泡泡字），放在上方或下方留白處，不可遮擋商品、不可喧賓奪主，繁體中文正確無錯字：\n${texts.join('\n')}`
      : '\n\n【文字】預設不放任何行銷文案，維持官方目錄的乾淨俐落感。'

  return `以我上傳的實拍照片為準，做成「樂扣樂扣 LocknLock 官方旗艦店風格」的乾淨電商主圖（參考 momo 官方賣場目錄圖：簡約、專業、白底）。

【整體風格】乾淨的官方目錄風：純白或極淺灰的無縫背景、明亮柔和的棚拍打光、商品底部加一道自然柔和陰影讓邊緣清晰（白色或淺色商品也要看得出輪廓、不會糊進白背景）。不要彩色背景、不要花俏裝飾、不要泡泡字、不要雜亂貼紙與促銷標。

【商品本體】完整保留真實外觀、材質、顏色與商品上原有的標誌；允許基礎調色與簡單修圖（曝光、白平衡、偏色、雜訊、輕微刮痕與反光）讓賣相乾淨專業，但不得改變造型與真實顏色識別。商品完整置中、佔畫面約 70–80%，正方形 1:1。若為多色或套組，可像官方一樣把商品整齊並排、乾淨呈現。

【品牌】在畫面上方放上乾淨的「樂扣樂扣 LocknLock」標準字（純文字、不使用 logo 圖案），低調、專業、有官方信任感。${textBlock}`
}

// 規格圖（AI 製圖）：丟白底圖，自動把規格排上去。specs = {capacity, weight, diameter, height, bottomWidth}
function buildSpecImagePrompt(product, specs = {}) {
  const rows = []
  if (product.name) rows.push(`品名：${product.name}`)
  if (specs.capacity && specs.capacity.trim()) rows.push(`容量：${specs.capacity.trim()}`)
  if (specs.weight && specs.weight.trim()) rows.push(`重量：${specs.weight.trim()}`)
  if (specs.diameter && specs.diameter.trim()) rows.push(`口徑：${specs.diameter.trim()}`)
  if (specs.height && specs.height.trim()) rows.push(`高度：${specs.height.trim()}`)
  if (specs.bottomWidth && specs.bottomWidth.trim()) rows.push(`底部寬度：${specs.bottomWidth.trim()}`)
  const specList = rows.length > 0 ? rows.join('\n') : '（尚未填寫規格，請先在上方填好）'

  return `以我上傳的「白底商品圖」為準，完整保留商品原樣（不重畫、不變形、不更動顏色），製作乾淨專業的電商「商品規格圖」。

在商品旁邊或下方的留白處，用整齊清楚的繁體中文「規格表」排版，列出以下規格（數字與文字必須與我提供的完全一致，一個字都不可更改、不可自行增減）：
${specList}

【排版要求】白底或極淺灰底、欄位對齊整齊、字體乾淨易讀、留白充足、不遮擋商品；風格簡潔專業、像品牌官方規格圖，不要花俏裝飾。正方形 1:1。${brandInstruction(product.brand)}`
}

// 情境圖：傳入這次要用的場景字串。
function buildScenePrompt(product, scene) {
  const name = product.name || '【品名】'
  const where = scene || '生活場景'
  return `以我上傳的實拍為商品參考，保持商品外觀、材質、顏色一致（不重畫商品）。將${name}自然放入「${where}」的生活情境，溫暖自然光、真實居家質感、淺景深，商品為視覺焦點，正方形 1:1。${brandInstruction(product.brand)}`
}

// 使用說明圖：傳入這次要用的版型字串。
function buildHowtoPrompt(product, variant) {
  const name = product.name || '【品名】'
  const layout = variant || '清楚的步驟圖解'
  return `以我上傳的實拍為商品參考，保持商品外觀一致（不重畫商品），製作清楚好懂的「商品使用說明圖」。請依商品自動判斷正確使用方式，用「${layout}」的版面，呈現 3–4 個精簡步驟。繁體中文、必須正確無錯字、字數精簡、步驟與數字清楚、不雜亂、不遮擋商品，正方形 1:1。${brandInstruction(product.brand)}`
}

// opts = { sellingPoints, mainTitle, subTitle, specs, scene, howto }
export function buildImagePrompt(type, product, opts = {}) {
  const { sellingPoints = '', mainTitle = '', subTitle = '', specs = {}, scene = '', howto = '' } = opts
  const colors = product.colors.length > 0 ? product.colors.join('/') : '【顏色】'
  const usesBaoKuan = product.brand !== PEARL_BRAND && product.brand !== LOCKNLOCK_BRAND

  switch (type) {
    case 'main':
      if (usesBaoKuan) return buildBaoKuanMainPrompt(product, { mainTitle, subTitle })
      if (product.brand === LOCKNLOCK_BRAND)
        return buildLocknlockOfficialPrompt(product, { sellingPoints, mainTitle, subTitle })
      return buildCleanMainPrompt(product, { sellingPoints, mainTitle, subTitle })
    case 'option':
      return (
        `以我上傳的${colors}實拍照片為準，商品外觀與顏色完全保留。去背，純白背景，正方形1:1，電商選項展示用。不得更動商品顏色。` +
        pearlLogoNote(product.brand)
      )
    case 'spec':
      return buildSpecImagePrompt(product, specs)
    case 'scene':
      return buildScenePrompt(product, scene)
    case 'howto':
      return buildHowtoPrompt(product, howto)
    default:
      return ''
  }
}
