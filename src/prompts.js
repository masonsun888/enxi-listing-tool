// 品牌與材質選項（供 ProductForm 與 prompt 共用）
export const BRANDS = ['樂扣', '珍珠金屬', '白牌']
export const MATERIALS = ['不鏽鋼', '鐵', 'PP塑膠', '塑膠', '塑料', '玻璃', '矽膠', '其他']

export const PEARL_BRAND = '珍珠金屬'
export const LOCKNLOCK_BRAND = '樂扣'

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
  return [
    TITLE_SYSTEM_PROMPT,
    '',
    '【商品資料】',
    formatProduct(product),
    '',
    '【競品標題】',
    competitors,
  ].join('\n')
}

// 分頁2：內文（權重內文 + 活潑長內文）
const BODY_SYSTEM_PROMPT = `你是蝦皮商品文案優化助手。請依據我提供的「真實商品資料」，產出下面兩個區塊的內容。

【硬規則】
- 商品的規格、容量、尺寸、材質、功能，只能使用我提供的真實資料，禁止編造或誇大。
- 我沒提供的數字或規格，一律不要寫，不准自己腦補。
- 語氣像人話、活潑親切，可適度用 emoji，但不要硬堆關鍵字。

─── 區塊一：權重內文（蝦皮搜尋用）───
產出一段 80–150 字的商品內文：
- 前 30 字內自然帶入 2–3 個核心搜尋關鍵字。
- 結尾一句簡短行動呼籲。
- 總字數嚴格 ≤ 150 字。

─── 區塊二：賣場活潑長內文 ───
請依商品自動判讀「使用情境與痛點」，產出（精簡、活潑、好讀）：
1.「痛點 → 解決」情境短文 2–3 段，每段用一個 emoji 開頭：先點出使用者的煩惱，再帶出本商品如何解決（只能根據真實賣點，不可編造功能）。
2.【商品規格】用條列整理我提供的材質 / 容量 / 尺寸 / 顏色等真實資料（我沒給的項目就不要列）。
3. 三個賣場注意事項小區塊，用親切口吻精簡改寫（這三段屬通用賣場條款，可保留）：
   ・【現貨即時補】台灣現貨、出貨前人工檢查、物流受損會負責處理。
   ・【開箱請錄影】請錄影開箱，方便數量／顏色／款式問題快速處理。
   ・【小公差說明】工藝商品可能有微小尺寸誤差與螢幕色差，完美主義者請斟酌下單。
4. 最後給 6–10 個適合本商品的蝦皮 hashtag（以 # 開頭，涵蓋品類、材質、容量、使用情境關鍵字）。

風格參考（僅供語氣與排版參考，實際內容請全部換成本商品的真實資料）：
😩 每天都要跑好幾趟飲水機補水，工作節奏一直被打斷⋯這款大容量直接幫你省下補水時間，裝滿一次撐到下班！
【商品規格】
・材質：316 不鏽鋼
・容量：1200ml
【現貨即時補】台灣現貨，出貨前兩次人工檢查，運送受損我們負責到底。
#大容量保溫瓶 #316不鏽鋼 #辦公室必備

輸出：直接給文案，不要額外解釋。`

export function buildBodyPrompt(product) {
  return [BODY_SYSTEM_PROMPT, '', '【商品資料】', formatProduct(product)].join('\n')
}

// 分頁3：製圖
export const IMAGE_TYPES = [
  { key: 'main', label: '主圖' },
  { key: 'option', label: '選項圖' },
  { key: 'spec', label: '規格圖' },
  { key: 'scene', label: '情境圖' },
]

// 珍珠金屬：每一張 AI 圖都要放上品牌 logo。
function pearlLogoNote(brand) {
  if (brand !== PEARL_BRAND) return ''
  return '\n本商品為「珍珠金屬（PEARL LIFE／パール金属）」品牌，請在圖片角落（建議左下或右下）放上我一併上傳的「珍珠金屬 PEARL LIFE」品牌 logo，logo 需清晰、比例自然、不變形、不可遮擋商品。'
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
function buildBaoKuanMainPrompt(product, mainTitle) {
  const title = mainTitle.trim() || '【請填入主標題】'
  return `【商品主圖設計 — 蝦皮／MOMO 爆款風格】

請參考我另外提供的版型風格圖。只保留參考圖的「整體排版結構、視覺層級、字體風格、廣告氛圍、電商轉換邏輯」，不得直接複製參考商品，商品需完全換成我這次上傳的實拍商品。

【商品資料】
${formatProduct(product)}

【輸入區】
・商品圖片：我上傳的實拍照（請完整保留真實外觀、材質、顏色，不得變形裁切）
・主標題：${title}

【AI 自動分析】依商品自動判斷：商品類型、使用情境、材質特色、核心痛點、主要賣點、目標客群，並自動生成：副標語、情境文案、功能文案、Callout 標題。

【版面結構】
・主商品：置於畫面右側，佔 60~70%，完整呈現、不裁切、不變形、高解析、真實質感。
・情境圖：左側放 1 個使用情境小圖，展示實際使用方式。
・主標題：畫面上方、雙行排版、大型藝術字、圓潤立體 3D 厚度、白色粗描邊、深色陰影、金色發光，依商品類型自動配色。
・副標語：主標下方，筆刷底圖，一句話講利益點（例：輕鬆洗到底／秒收納不佔位）。
・賣點區：只保留 1 個最重要賣點，大 ICON、白底圓角框、金色描邊，依商品自動生成（例：食品級矽膠／304不鏽鋼／防水防塵）。
・情境標語：主商品附近，藝術字，紅或橘色系、白色描邊，強化購買動機（例：一掛即用！／超省空間！）。

【背景】依商品自動生成最適合場景，背景柔焦、高級生活感、商品清晰、背景不搶主體、電商攝影棚等級、自然景深。
【光線】右上暖陽光暈 Sunburst Glow、高亮度、柔和陰影、產品邊緣高光。
【配色規則】清潔用品→藍+橘；收納用品→奶油+木質；汽機車用品→黑+紅+金；廚房用品→黃+橘；衛浴用品→藍+白；高級用品→香檳金+深咖啡（AI 依商品自動判斷）。

【禁止事項】不要品牌 LOGO、不要浮水印、不要多餘 ICON、不要複雜資訊框、不要價格、不要促銷貼紙、不要台灣出貨徽章、不要遮擋商品、不要錯字。

【輸出要求】繁體中文、蝦皮爆款風格、MOMO 商品頁風格、高轉換率電商主圖、Commercial Advertising Design、Ultra Realistic Product Photography、1:1 Square、4K Ultra HD、商品絕對清晰、背景柔焦、真實攝影感。`
}

// 珍珠金屬 / 樂扣 主圖：乾淨真實商品圖（保留外觀，依品牌決定是否放 logo）。
function buildCleanMainPrompt(product, sellingPoints) {
  let base =
    '以我上傳的實拍照片為準，保持商品的真實外觀、材質、顏色完全不變，並完整保留商品上原有的標誌與印刷文字，絕對不得移除、塗改、淡化或重畫。只做：去背，換成乾淨的純白到淺灰漸層背景；柔和棚拍打光，並在商品底部加一道自然柔和陰影，確保白色或淺色商品與背景有清楚對比、邊緣清晰、不會糊進背景消失；商品完整置中、佔畫面約75%；正方形1:1電商主圖。不得修改、重畫或美化商品本體。'

  if (product.brand === PEARL_BRAND) {
    base += pearlLogoNote(product.brand)
  } else if (product.brand === LOCKNLOCK_BRAND) {
    base += '\n保留商品原樣即可，不需另外加上任何品牌 logo 或浮水印。'
  }

  if (sellingPoints.trim()) {
    base +=
      '\n\n另外，請在不遮擋商品與標誌的留白區（畫面上方或下方），用清楚專業的電商排版加入以下繁體中文賣點文字，字體乾淨易讀、必須是正確無錯字的繁體中文：\n' +
      sellingPoints.trim()
  }
  return base
}

// opts = { sellingPoints, mainTitle }
export function buildImagePrompt(type, product, opts = {}) {
  const { sellingPoints = '', mainTitle = '' } = opts
  const name = product.name || '【品名】'
  const colors = product.colors.length > 0 ? product.colors.join('/') : '【顏色】'
  const usesBaoKuan = product.brand !== PEARL_BRAND && product.brand !== LOCKNLOCK_BRAND

  switch (type) {
    case 'main':
      return usesBaoKuan
        ? buildBaoKuanMainPrompt(product, mainTitle)
        : buildCleanMainPrompt(product, sellingPoints)
    case 'option':
      return (
        `以我上傳的${colors}實拍照片為準，商品外觀與顏色完全保留。去背，純白背景，正方形1:1，電商選項展示用。不得更動商品顏色。` +
        pearlLogoNote(product.brand)
      )
    case 'scene':
      return (
        `以我上傳的實拍為商品參考，保持商品外觀一致。將${name}自然放入【辦公桌/廚房/野餐/客廳，擇一】的生活場景，溫暖自然光，居家質感，商品為視覺焦點，正方形1:1。` +
        pearlLogoNote(product.brand)
      )
    default:
      return ''
  }
}
