# 恩希 SKU 健康管理系統

最小可運行版（MVP pipeline）。目的：先打通「**開發 → 部署 → 手機能打開網址**」這條管線，
之後再逐步加功能。

## 技術

- Cloudflare Workers + Static Assets（靜態首頁放在 `public/`）
- Cloudflare D1 資料庫：`enxi-sku`（綁定為 `env.DB`，目前僅綁定，尚未建表）
- 部署工具：Wrangler

## 結構

```
public/index.html   # 首頁（顯示標題與「部署成功」）
worker/index.js     # Worker：服務靜態首頁 + /api/health 健康檢查
wrangler.toml       # 部署設定（name / assets / D1 綁定）
```

## 本機開發

```bash
npm install
npm run dev          # wrangler dev，本機預覽
```

## 部署到 Cloudflare

需要先設定環境變數 `CLOUDFLARE_API_TOKEN`（見下方）。

```bash
# 1. 建立 D1 資料庫（只需做一次），把回傳的 database_id 填回 wrangler.toml
npm run d1:create

# 2. 部署
npm run deploy
```

部署完成後 Wrangler 會印出 `https://enxi-sku.<你的子網域>.workers.dev`，手機瀏覽器即可打開。

## 設定 CLOUDFLARE_API_TOKEN

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/) → 右上頭像 → **My Profile** → **API Tokens**。
2. **Create Token** → 用 **Edit Cloudflare Workers** 範本（或自訂，需含 Workers Scripts、D1、Workers KV、Account/User 讀取等權限）。
3. 複製產生的 Token，在終端機設定：

   ```bash
   export CLOUDFLARE_API_TOKEN="貼上你的token"
   ```

## 健康檢查

部署後可開 `https://<你的網址>/api/health`，會回傳 JSON，其中 `d1Bound: true` 代表 D1 綁定成功。
