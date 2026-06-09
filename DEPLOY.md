# 自動部署到 Cloudflare Pages（Git 連動）

採用 **Cloudflare Pages 原生 Git 連動**：連一次之後，每次 push 到 GitHub 就會自動 build + 部署，
不需要任何 API 金鑰、不需要 GitHub Actions。

## 一次性設定步驟

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/) → 左側選 **Workers & Pages**。
2. 點 **Create application** → **Pages** 分頁 → **Connect to Git**。
3. 授權並選擇 GitHub repo：`masonsun888/enxi-listing-tool`。
4. **Set up builds and deployments** 填入：
   - **Production branch**：`main`（先把這個分支合併進 main，或改成你要的分支）
   - **Framework preset**：`Vite`（或選 None，下面手動填）
   - **Build command**：`npm run build`
   - **Build output directory**：`dist`
   - **Root directory**：留空（專案在 repo 根目錄）
5. 點 **Save and Deploy**。

第一次部署完成後，Cloudflare 會給一個網址（例：`enxi-listing-tool.pages.dev`）。

## 之後的更新

- **正式站**：把改動合併進 `main` → 自動部署到正式網址。
- **預覽站**：push 到任何其他分支（含目前的 `claude/...` 分支）→ Cloudflare 自動產生一個獨立的
  Preview 網址，方便先看效果再合併。

## 備註

- `.nvmrc` 已釘 Node 22，Cloudflare 會自動用相同版本 build，避免「本地可以、線上掛掉」。
- 純前端靜態網站，無後端、無環境變數需要設定。
- 若要綁自訂網域：Pages 專案 → **Custom domains** → 加上你的網域即可。
