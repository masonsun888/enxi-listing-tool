// 防呆提示（固定顯示在頁面底部）
const TIPS = [
  'AI 寫的規格、容量、材質，一定要對著實物再核一次。',
  '主圖/選項圖只能去背換背景，不能讓 AI 重畫商品。',
  '競品關鍵字只抄品類詞，別人的品牌名一個字都不准放。',
  'Momo 標題超過 60 字元要重生。',
]

export default function Footer() {
  return (
    <section className="mt-6 rounded-2xl border-2 border-rose-200 bg-rose-50 p-4">
      <h3 className="mb-2 text-base font-bold text-rose-700">🛟 防呆提示</h3>
      <ol className="list-decimal space-y-2 pl-5 text-base leading-relaxed text-rose-800">
        {TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ol>
    </section>
  )
}
