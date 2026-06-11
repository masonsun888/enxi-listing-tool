import { useState } from 'react'
import ResultBox from './ResultBox.jsx'
import {
  IMAGE_TYPES,
  SCENE_OPTIONS,
  HOWTO_OPTIONS,
  buildImagePrompt,
  PEARL_BRAND,
  LOCKNLOCK_BRAND,
} from '../prompts.js'

const labelCls = 'mb-1 block text-base font-bold text-slate-700'
const inputCls =
  'w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-lg text-slate-800 focus:border-teal-500 focus:outline-none'

// 從清單挑一個與上次不同的（達成「每按一次換一個」）
function pickDifferent(arr, last) {
  if (arr.length <= 1) return arr[0]
  let v = last
  while (v === last) v = arr[Math.floor(Math.random() * arr.length)]
  return v
}

// 分頁3：製圖
export default function ImageTab({ product, work, setWork }) {
  const [type, setType] = useState('main')
  const [result, setResult] = useState('')
  const [variant, setVariant] = useState('') // 本次情境/版型
  const { sellingPoints, mainTitle, subTitle } = work
  const set = (k, v) => setWork((w) => ({ ...w, [k]: v }))

  const isMain = type === 'main'
  const isSpec = type === 'spec'
  const isScene = type === 'scene'
  const isHowto = type === 'howto'
  const isRotating = isScene || isHowto
  const isPearl = product.brand === PEARL_BRAND
  const isLocknlock = product.brand === LOCKNLOCK_BRAND
  const usesBaoKuan = product.brand !== PEARL_BRAND && product.brand !== LOCKNLOCK_BRAND

  const specs = {
    capacity: work.specCapacity,
    weight: work.specWeight,
    diameter: work.specDiameter,
    height: work.specHeight,
    bottomWidth: work.specBottomWidth,
  }

  function generate() {
    if (isScene) {
      const s = pickDifferent(SCENE_OPTIONS, variant)
      setVariant(s)
      setResult(buildImagePrompt('scene', product, { scene: s }))
    } else if (isHowto) {
      const h = pickDifferent(HOWTO_OPTIONS, variant)
      setVariant(h)
      setResult(buildImagePrompt('howto', product, { howto: h }))
    } else if (isSpec) {
      setResult(buildImagePrompt('spec', product, { specs }))
    } else {
      setResult(buildImagePrompt(type, product, { sellingPoints, mainTitle, subTitle }))
    }
  }

  function selectType(key) {
    setType(key)
    setResult('')
    setVariant('')
  }

  return (
    <div>
      <label className="mb-2 block text-base font-bold text-slate-700">選擇圖種</label>
      <div className="grid grid-cols-2 gap-3">
        {IMAGE_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => selectType(t.key)}
            className={`rounded-2xl py-6 text-xl font-bold shadow-sm transition active:scale-[0.97] ${
              type === t.key
                ? 'bg-teal-600 text-white'
                : 'bg-white text-slate-700 border-2 border-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 珍珠金屬：每張 AI 圖都放 logo（右上角），提醒一併上傳 logo 圖 */}
      {isPearl && (
        <div className="mt-4 rounded-2xl border-2 border-sky-300 bg-sky-50 p-4 text-base font-semibold text-sky-800">
          🏷️ 珍珠金屬：貼指令到 GPT 時，請「連同商品圖 + 珍珠金屬 logo 圖」一起上傳，指令會請 AI 把 logo 放到圖片右上角。
        </div>
      )}

      {/* 樂扣樂扣主圖：官方旗艦店乾淨白底風 */}
      {isMain && isLocknlock && (
        <div className="mt-4 rounded-2xl border-2 border-sky-300 bg-sky-50 p-4 text-base font-semibold text-sky-800">
          🏷️ 樂扣樂扣＝官方旗艦店風（乾淨白底、專業棚拍）。主標題/副標題/賣點都「選填」，留空則產生最乾淨的官方目錄圖；不使用 logo 圖、不必上傳。
        </div>
      )}

      {/* 規格圖：填規格欄位，AI 自動排版到白底圖上 */}
      {isSpec && (
        <div className="mt-4 space-y-3">
          <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">
            填好規格 → 上傳白底商品圖 → AI 自動把資訊排上去（品名取自上方「品名」，品牌字/ logo 也會自動套）。
          </p>
          <div>
            <label className={labelCls}>容量</label>
            <input type="text" value={work.specCapacity} onChange={(e) => set('specCapacity', e.target.value)} placeholder="例：500ml" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>重量（如有）</label>
            <input type="text" value={work.specWeight} onChange={(e) => set('specWeight', e.target.value)} placeholder="例：280g" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>產品口徑（如有）</label>
            <input type="text" value={work.specDiameter} onChange={(e) => set('specDiameter', e.target.value)} placeholder="例：7cm" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>產品高度</label>
            <input type="text" value={work.specHeight} onChange={(e) => set('specHeight', e.target.value)} placeholder="例：20cm" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>底部寬度</label>
            <input type="text" value={work.specBottomWidth} onChange={(e) => set('specBottomWidth', e.target.value)} placeholder="例：6.5cm" className={inputCls} />
          </div>
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
            ⚠️ 規格數字最重要！圖出來後務必逐字核對數字有沒有寫錯，錯了就重生。
          </p>
        </div>
      )}

      {/* 主圖：主標題 + 副標題 */}
      {isMain && (
        <div className="mt-4">
          <label className={labelCls}>主圖主標題（大藝術字，留空 AI 自動生成）</label>
          <input
            type="text"
            value={mainTitle}
            onChange={(e) => set('mainTitle', e.target.value)}
            placeholder="例：小貓保溫杯"
            className={inputCls}
          />
        </div>
      )}

      {isMain && (
        <div className="mt-3">
          <label className={labelCls}>副標題（選填，放主標題下方的小標語）</label>
          <input
            type="text"
            value={subTitle}
            onChange={(e) => set('subTitle', e.target.value)}
            placeholder="例：一鍵彈蓋 保溫保冰"
            className={inputCls}
          />
        </div>
      )}

      {isMain && !usesBaoKuan && (
        <div className="mt-3">
          <label className={labelCls}>賣點小標（選填，一行一個，會排成比主標題小的藝術字）</label>
          <textarea
            rows={3}
            value={sellingPoints}
            onChange={(e) => set('sellingPoints', e.target.value)}
            placeholder={'例：\n一鍵彈跳\n保溫保冰\n316不鏽鋼'}
            className="w-full resize-none rounded-xl border-2 border-slate-200 bg-white p-4 text-base text-slate-800 focus:border-teal-500 focus:outline-none"
          />
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
            ⚠️ AI 畫的中文字常會出錯，圖出來後一定要逐字核對；有錯字就重生或改用排版套字。
          </p>
        </div>
      )}

      {isMain && usesBaoKuan && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
          ⚠️ 白牌走「爆款設計圖」版型：請另外上傳一張你喜歡的版型參考圖給 GPT，AI 畫的中文字一樣要逐字核對。
        </p>
      )}

      {/* 情境圖 / 使用說明：每按一次換一個 */}
      {isRotating && (
        <p className="mt-4 rounded-xl bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">
          🔄 每按一次「產生」會自動換一個{isScene ? '情境場景' : '版型'}（共 {(isScene ? SCENE_OPTIONS : HOWTO_OPTIONS).length} 種）。
        </p>
      )}

      <button
        type="button"
        onClick={generate}
        className="mt-4 w-full rounded-2xl bg-slate-800 py-5 text-xl font-bold text-white shadow-md active:scale-[0.98]"
      >
        {isRotating ? '產生指令（再按換一個）' : '產生製圖指令'}
      </button>

      {isRotating && variant && (
        <p className="mt-2 text-center text-sm font-bold text-teal-700">
          本次：{variant}
        </p>
      )}

      <ResultBox value={result} rows={12} />
    </div>
  )
}
