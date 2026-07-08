// 共用的空白商品（App 初始值與「新商品」皆用這個，避免重複定義）
export const makeDefaultProduct = () => ({
  brand: '樂扣樂扣',
  name: '樂扣樂扣',
  size: '',
  material: '不鏽鋼',
  colors: [],
})

// 新品九圖模式的空白商品：固定白牌、品名留白給員工填。
export const makeNineDefaultProduct = () => ({
  brand: '白牌',
  name: '',
  size: '',
  material: '不鏽鋼',
  colors: [],
})

// 每個商品的「工作區」：各分頁的輸入與產出，存進商品後載入即全有。
export const makeEmptyWork = () => ({
  competitorTitles: '',
  titleResult: '',
  bodyResult: '',
  mainTitle: '',
  subTitle: '',
  sellingPoints: '',
  cost: '',
  // 規格圖欄位
  specCapacity: '',
  specWeight: '',
  specDiameter: '',
  specHeight: '',
  specBottomWidth: '',
  // 新品九圖：{ analysis, palettePick, customMainTitle, mainTitlePick, heroVariant, done[9], optionDone, copiedSlots }
  nine: null,
  // 新品一鍵上架文案：{ mainKeyword, competitorTitles, result, checks }
  nineCopy: null,
  // 優化舊品·卡1：{ currentTitle, competitorTitles, mustInclude[], titleResults[], rationale, shownIdx }
  optimize: null,
  // 白牌定價卡的「你想賣」欄位（cost 沿用上面的 cost）
  nineSellPrice: '',
})

// 進度勾選狀態
export const makeEmptyDone = () => ({
  title: false,
  body: false,
  image: false,
  price: false,
  listed: false,
})
