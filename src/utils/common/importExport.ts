export function exportAsJSON(data: unknown, filename: string): void {
  const jsonStr = JSON.stringify(data, null, 2)
  downloadFile(jsonStr, filename, 'application/json')
}

export function exportAsText(content: string, filename: string): void {
  downloadFile(content, filename, 'text/plain;charset=utf-8')
}

export function exportAsCSV(content: string, filename: string): void {
  const bom = '\uFEFF'
  downloadFile(bom + content, filename, 'text/csv;charset=utf-8')
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

export function loadImageFromDataURL(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图像加载失败'))
    img.src = dataUrl
  })
}

export async function loadPageImageFromFile(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  const dataUrl = await readFileAsDataURL(file)
  const img = await loadImageFromDataURL(dataUrl)
  return { dataUrl, width: img.width, height: img.height }
}

export function parseJSONSafe<T>(str: string): { valid: boolean; data?: T; message?: string } {
  try {
    const data = JSON.parse(str) as T
    return { valid: true, data }
  } catch {
    return { valid: false, message: 'JSON解析失败，文件内容不是合法JSON' }
  }
}
