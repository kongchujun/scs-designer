const cache = new Map<string, HTMLImageElement>()

/** 将设计文档里存的图像路径转为可请求的 URL */
export function resolveImageUrl(path: string): string {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }
  if (path.startsWith('/')) return path
  // 仅文件名
  return `/api/v1/uploads/files/${path.replace(/^\/+/, '')}`
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // 同源资源不要设 crossOrigin，否则部分 SVG 无法绘制到 Konva
    img.onload = () => {
      if (img.naturalWidth === 0 && img.naturalHeight === 0) {
        img.width = 120
        img.height = 80
      }
      resolve(img)
    }
    img.onerror = () => reject(new Error(`无法加载图像: ${src}`))
    img.src = src
  })
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const resolved = resolveImageUrl(url)
  if (!resolved) return Promise.reject(new Error('图像 URL 为空'))

  const hit = cache.get(resolved)
  if (hit) return hit

  const lower = resolved.toLowerCase()
  const isSvg = lower.includes('.svg')

  try {
    let img: HTMLImageElement
    if (isSvg) {
      const res = await fetch(resolved)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      try {
        img = await loadImageElement(objectUrl)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    } else {
      img = await loadImageElement(resolved)
    }
    cache.set(resolved, img)
    return img
  } catch (e) {
    throw new Error(`无法加载图像: ${resolved}${e instanceof Error ? ` (${e.message})` : ''}`)
  }
}

export function clearImageCache() {
  cache.clear()
}
