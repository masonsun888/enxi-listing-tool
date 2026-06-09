# 恩希上架工具

給內勤員工用的「填空式」電商上架輔助工具。手機優先，純前端，不需後端 / API key / 資料庫。

員工只要：**填空 → 按產生 → 複製**，就能拿到：
- 可貼到蝦皮 / Momo 的上架文案指令（標題、內文）
- 可貼到 GPT 的製圖指令

> v1 不直接呼叫任何 AI API，而是組裝出完整 prompt 文字 + 一鍵複製，員工自己貼到 Gemini / GPT。

## 功能

最上面固定「商品基本資料」（三個分頁共用）：品牌、品名、容量/尺寸、材質、顏色（多 tag）。

三個分頁：
1. **標題** — 貼上競品標題，產生蝦皮 + Momo 標題優化指令。
2. **內文** — 沿用商品資料，產生 80–150 字內文指令。
3. **製圖** — 選圖種（主圖 / 選項圖 / 規格圖 / 情境圖），產生對應製圖指令；規格圖改為輸出可套版的文字標籤。

頁面底部固定 4 條防呆提示。

## 技術

- Vite + React + Tailwind CSS（v4）
- 純前端靜態網站，`npm run build` 輸出到 `dist`（接 Cloudflare Pages）

## 開發

```bash
npm install
npm run dev      # 本地開發
npm run build    # 輸出 dist/
npm run preview  # 預覽 build 結果
```

## 部署（Cloudflare Pages）

- Build command：`npm run build`
- Build output directory：`dist`
