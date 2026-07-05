// 前端圖片壓縮：canvas 縮圖至長邊 ≤1024、JPEG quality 0.8。
// EXIF 方向：優先用 createImageBitmap 的 imageOrientation: 'from-image'；
// 退回 <img> 時，現代瀏覽器預設 image-orientation: from-image，也會自動轉正。

async function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // 舊瀏覽器不支援選項或格式 → 退回 <img>
    }
  }
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('圖片載入失敗'))
    }
    img.src = url
  })
}

// 回傳 { dataUrl, base64 }：dataUrl 給縮圖顯示，base64（純資料）給 /api/analyze。
export async function compressToJpeg(file, maxEdge = 1024, quality = 0.8) {
  const bitmap = await loadBitmap(file)
  const srcW = bitmap.width || bitmap.naturalWidth
  const srcH = bitmap.height || bitmap.naturalHeight
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH))
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff' // PNG 透明底轉 JPEG 會變黑，先墊白
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  if (bitmap.close) bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return { dataUrl, base64: dataUrl.split(',')[1] }
}

// 把 dataURL 存成檔案（走 blob URL，手機瀏覽器相容性比直接下載 data: 好）。
export function downloadDataUrl(dataUrl, filename) {
  const base64 = dataUrl.split(',')[1]
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'image/jpeg' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
