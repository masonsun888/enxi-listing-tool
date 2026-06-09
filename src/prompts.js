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

// 分頁2：內文
const BODY_SYSTEM_PROMPT = `你是蝦皮商品內文優化助手。產出一段 80–150 字的商品內文。
硬規則：
- 只用我提供的真實資料，禁止編造。
- 前 30 字內自然帶入 2–3 個核心搜尋關鍵字。
- 像人話，禁止關鍵字硬堆砌。
- 結尾一句簡短行動呼籲。
- 總字數嚴格 ≤ 150 字。
輸出：直接給內文純文字，不要任何解釋。`

export function buildBodyPrompt(product) {
  return [
    BODY_SYSTEM_PROMPT,
    '',
    '【商品資料】',
    formatProduct(product),
  ].join('\n')
}

// 分頁3：製圖
export const IMAGE_TYPES = [
  { key: 'main', label: '主圖' },
  { key: 'option', label: '選項圖' },
  { key: 'spec', label: '規格圖' },
  { key: 'scene', label: '情境圖' },
]

// 規格圖不經 AI，回傳一段可複製的文字標籤供排版用。
export function buildSpecLabel(product) {
  return [
    `品名：${product.name || '（未填）'}`,
    `容量/尺寸：${product.size || '（未填）'}`,
    `材質：${product.material || '（未填）'}`,
  ].join('\n')
}

export function buildImagePrompt(type, product) {
  const name = product.name || '【品名】'
  const colors = product.colors.length > 0 ? product.colors.join('/') : '【顏色】'

  switch (type) {
    case 'main':
      return '以我上傳的實拍照片為準，保持商品的真實外觀、材質、顏色完全不變。只做：去背，換成純白到淺灰乾淨漸層背景，柔和棚拍打光，商品置中佔畫面約75%，無文字無浮水印，正方形1:1電商主圖。不得修改、重畫或美化商品本體。'
    case 'option':
      return `以我上傳的${colors}實拍照片為準，商品外觀與顏色完全保留。去背，純白背景，正方形1:1，電商選項展示用。不得更動商品顏色。`
    case 'scene':
      return `以我上傳的實拍為商品參考，保持商品外觀一致。將${name}自然放入【辦公桌/廚房/野餐/客廳，擇一】的生活場景，溫暖自然光，居家質感，商品為視覺焦點，正方形1:1。`
    default:
      return ''
  }
}
