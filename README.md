# 恩希上架工具

給內勤員工用的「填空式」電商上架輔助工具。手機優先。

員工只要：**填空 → 按產生 → 複製**，就能拿到：
- 可貼到蝦皮 / Momo 的上架文案指令（標題、內文）
- 可貼到 GPT 的製圖指令

> 生圖引擎照舊是 ChatGPT：本工具只產 prompt，不呼叫任何生圖 API。

## 兩種模式

### ⚡ 白牌九圖（預設）

上傳素材＋填規格 → 按一顆按鈕 → 得到九張「配色連貫」的製圖 prompt 工作單，逐張複製貼給 GPT 生圖。

- 素材圖前端壓縮（長邊 ≤1024、JPEG 0.8）後送 `/api/analyze`（Cloudflare Worker → Anthropic vision），回一份分析卡 JSON：商品主色、主配色＋備選配色、文案素材、素材健檢。素材圖不落地。
- 前端模板引擎 `src/nineTemplates.js`（純函式、零 AI）把分析卡＋人填規格組成九張 prompt：Hero 爆款主圖／賣點介紹 ×3／情境 ×3／尺寸規格圖／使用前後比較圖，外加每色一張選項圖。
- 連貫性靠同一組 hex：換配色＝切到備選那組、九張前端瞬間重組，零 API 呼叫。
- 規格數字一律人填，AI 只負責排版；每張卡附「文字核對清單」。
- 有問題的素材（簡體字浮水印、他牌 logo…）縮圖會標紅 ⚠。

### 🗂 經典模式

原有四分頁工作流（樂扣樂扣、珍珠金屬照舊）：

1. **標題** — 貼上競品標題，產生蝦皮 + Momo 標題優化指令。
2. **內文** — 沿用商品資料，產生 80–150 字內文指令。
3. **製圖** — 選圖種（主圖 / 選項圖 / 規格圖 / 情境圖 / 使用說明），產生對應製圖指令。
4. **定價** — 成本試算。

## 技術

- Vite + React + Tailwind CSS（v4）
- Cloudflare Worker（`worker/`）：靜態檔 + `/api/products`（KV 商品儲存）+ `/api/analyze`（Anthropic vision 分析）
- `npm run build` 輸出到 `dist`

## 開發

```bash
npm install
npm run dev      # 本地開發
npm run build    # 輸出 dist/
npm run preview  # 預覽 build 結果
npm test         # 單元測試（模板引擎 + analyze schema 驗證）
```

## 白牌九圖上線前置（一次性）

1. `wrangler secret put ANTHROPIC_API_KEY` — 沒設的話 `/api/analyze` 回 503，前端會提示「後台尚未設定 AI 金鑰」。
2. 挑 1 張最會賣的爆款成品當「標準版型參考圖」，放到 `public/assets/hero-ref-1.jpg`（Hero 卡片的下載鈕會抓這個路徑）。
3. 手動打 API 驗證：`./scripts/test-analyze.sh https://你的網址 ./某張商品圖.jpg [密碼]`。

## 部署（Cloudflare Pages）

- Build command：`npm run build`
- Build output directory：`dist`
