import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 純前端靜態網站，輸出到 dist（之後接 Cloudflare Pages）
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
