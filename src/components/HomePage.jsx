// 🏠 首頁／使用說明：給第一天上工的員工看的「這工具怎麼用」，白話、簡約、有流程圖。
// onPick(modeKey)：點模式卡直接跳進去。

const STEPS = [
  { n: '1', icon: '📝', title: '填資料', desc: '選商品、填品名/貨號' },
  { n: '2', icon: '🔘', title: '按一個按鈕', desc: 'AI 幫你想好' },
  { n: '3', icon: '📋', title: '複製貼上', desc: '貼蝦皮／貼 GPT' },
]

const MODES = [
  {
    key: 'nine',
    icon: '⚡',
    name: '新品九圖',
    when: '全新商品，要「一整套」圖＋文案',
    flow: ['上傳商品圖＋填品名', '按「首次分析」（AI 讀圖）', '勾一次策略', '八張製圖指令＋文案，逐張複製貼給 GPT／蝦皮'],
  },
  {
    key: 'optimize',
    icon: '🔧',
    name: '優化舊品',
    when: '已經在賣的商品，只想「補強」標題／內文／主圖',
    flow: ['左側選一個已存商品', '貼幾條競品標題', '一鍵出優化標題＋內文（可直接改）', '（想換主圖再做卡3）'],
  },
  {
    key: 'classic',
    icon: '🗂',
    name: '經典模式',
    when: '樂扣樂扣、珍珠金屬這種老品牌照舊',
    flow: ['填商品基本資料', '標題／內文／製圖／定價分頁', '各自產生指令、複製'],
  },
]

function Arrow() {
  return (
    <span className="flex items-center justify-center text-2xl text-accent">
      <span className="hidden sm:inline">→</span>
      <span className="sm:hidden">↓</span>
    </span>
  )
}

export default function HomePage({ onPick }) {
  return (
    <div className="space-y-8">
      {/* 歡迎 */}
      <section className="rounded-[16px] border border-line bg-surface p-6 text-center shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">恩希上架工具</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
          幫你把商品變成「可以直接貼蝦皮的文案」和「可以貼給 ChatGPT 的製圖指令」。
          <br />
          不用會設計、不用會下指令——<span className="font-bold text-ink">填空 → 按鈕 → 複製</span>，就這麼簡單。
        </p>
      </section>

      {/* 三步驟大流程 */}
      <section>
        <h2 className="mb-3 text-center text-lg font-bold text-ink">怎麼用？三步驟</h2>
        <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
          {STEPS.map((s, i) => (
            <div key={s.n} className="contents">
              <div className="rounded-[12px] border border-line bg-surface p-5 text-center shadow-sm">
                <div className="text-4xl">{s.icon}</div>
                <p className="mt-2 text-base font-bold text-ink">
                  <span className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-sm text-white">
                    {s.n}
                  </span>
                  {s.title}
                </p>
                <p className="mt-1 text-sm text-muted">{s.desc}</p>
              </div>
              {i < STEPS.length - 1 && <Arrow />}
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-muted">
          💰 有「AI」字樣的按鈕＝按一次花老闆的錢（約 NT$0.5）。資料填好再按，一次到位。
        </p>
      </section>

      {/* 三種模式：什麼時候用哪個 */}
      <section>
        <h2 className="mb-3 text-center text-lg font-bold text-ink">三種模式，什麼時候用哪個？</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {MODES.map((m) => (
            <div key={m.key} className="flex flex-col rounded-[12px] border border-line bg-surface p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{m.icon}</span>
                <span className="text-lg font-bold text-ink">{m.name}</span>
              </div>
              <p className="mt-1 rounded-[8px] bg-accent/10 px-3 py-2 text-sm font-semibold text-ink">
                👉 {m.when}
              </p>
              <ol className="mt-3 flex-1 space-y-1.5">
                {m.flow.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-line/60 text-xs font-bold text-ink">
                      {i + 1}
                    </span>
                    {f}
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={() => onPick(m.key)}
                className="mt-4 w-full rounded-[8px] bg-primary py-2.5 text-base font-bold text-white transition active:scale-[0.98]"
              >
                進入{m.name} →
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 幾個常見狀況 */}
      <section className="rounded-[12px] border border-line bg-surface p-5 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-ink">📌 幾個一定要知道的</h2>
        <ul className="space-y-1.5 text-sm text-muted">
          <li>・做好的東西會<span className="font-bold text-ink">自動存雲端</span>；記得偶爾按左邊「💾 備份全部」下載一份存電腦。</li>
          <li>・找舊商品：左邊搜尋框打<span className="font-bold text-ink">貨號或品名</span>。</li>
          <li>・製圖時如果試出「哪句提示詞特別有效」，用下面「💡 提示詞新發現」記一筆，之後能匯出報告。</li>
          <li>・AI 寫的規格、材質<span className="font-bold text-ink">一定要對著實物再核一次</span>，數字錯一個字＝客訴。</li>
        </ul>
      </section>
    </div>
  )
}
