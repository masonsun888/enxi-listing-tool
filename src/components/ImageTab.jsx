import { useState } from 'react'
import ResultBox from './ResultBox.jsx'
import {
  IMAGE_TYPES,
  buildImagePrompt,
  buildSpecLabel,
  PEARL_BRAND,
  LOCKNLOCK_BRAND,
} from '../prompts.js'

// 分頁3：製圖
export default function ImageTab({ product }) {
  const [type, setType] = useState('main')
  const [result, setResult] = useState('')
  const [sellingPoints, setSellingPoints] = useState('')
  const [mainTitle, setMainTitle] = useState('')

  const isSpec = type === 'spec'
  const isMain = type === 'main'
  const isPearl = product.brand === PEARL_BRAND
  const isLocknlock = product.brand === LOCKNLOCK_BRAND
  // 白牌／其他品牌主圖走「爆款設計」版型；珍珠金屬／樂扣走乾淨實拍圖。
  const usesBaoKuan = product.brand !== PEARL_BRAND && product.brand !== LOCKNLOCK_BRAND

  function generate() {
    if (type === 'spec') {
      setResult(buildSpecLabel(product))
    } else {
      setResult(buildImagePrompt(type, product, { sellingPoints, mainTitle }))
    }
  }

  function selectType(key) {
    setType(key)
    setResult('')
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

      {isSpec && (
        <div className="mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-base font-semibold text-amber-800">
          ⚠️ 規格圖請用固定排版模板套版，不要用 AI 生成，避免中文字寫錯。
          <br />
          下方是整理好的容量/尺寸/材質文字標籤，複製後拿去套版。
        </div>
      )}

      {/* 珍珠金屬：所有 AI 圖都要放 logo，提醒員工一併上傳 logo 圖 */}
      {!isSpec && isPearl && (
        <div className="mt-4 rounded-2xl border-2 border-sky-300 bg-sky-50 p-4 text-base font-semibold text-sky-800">
          🏷️ 珍珠金屬：貼指令到 GPT 時，請「連同商品實拍照 + 珍珠金屬 logo 圖」一起上傳，指令會請 AI 把 logo 放到圖片右上角。
        </div>
      )}

      {/* 樂扣樂扣主圖：純品牌字置頂，不用 logo */}
      {isMain && isLocknlock && (
        <div className="mt-4 rounded-2xl border-2 border-sky-300 bg-sky-50 p-4 text-base font-semibold text-sky-800">
          🏷️ 樂扣樂扣：品牌名會以「標準字」放在標題最上方，不使用 logo 圖、不必上傳 logo。
        </div>
      )}

      {/* 主圖：所有品牌都有主標題；珍珠金屬／樂扣樂扣 另有賣點小標 */}
      {isMain && (
        <div className="mt-4">
          <label className="mb-1 block text-base font-bold text-slate-700">
            主圖主標題（大藝術字，留空 AI 自動生成）
          </label>
          <input
            type="text"
            value={mainTitle}
            onChange={(e) => setMainTitle(e.target.value)}
            placeholder="例：大容量保溫瓶"
            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-lg text-slate-800 focus:border-teal-500 focus:outline-none"
          />
        </div>
      )}

      {isMain && !usesBaoKuan && (
        <div className="mt-3">
          <label className="mb-1 block text-base font-bold text-slate-700">
            賣點小標（選填，一行一個，會排成比主標題小的藝術字）
          </label>
          <textarea
            rows={3}
            value={sellingPoints}
            onChange={(e) => setSellingPoints(e.target.value)}
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

      <button
        type="button"
        onClick={generate}
        className="mt-4 w-full rounded-2xl bg-slate-800 py-5 text-xl font-bold text-white shadow-md active:scale-[0.98]"
      >
        {isSpec ? '產生規格文字標籤' : '產生製圖指令'}
      </button>

      <ResultBox value={result} rows={isSpec ? 5 : 12} />
    </div>
  )
}
