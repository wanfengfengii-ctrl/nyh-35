import { ref } from 'vue'
import { useNotify } from '@/utils/common/notification'
import {
  exportAsJSON,
  exportAsText,
  exportAsCSV,
  readFileAsText,
  parseJSONSafe
} from '@/utils/common/importExport'

export function useImportExport() {
  const notify = useNotify()
  const isProcessing = ref(false)
  const lastError = ref<string | null>(null)

  function exportJSON<T>(data: T, filename: string): void {
    try {
      exportAsJSON(data, filename)
      notify.success(`已导出 ${filename}`)
    } catch (e) {
      const msg = (e as Error).message || '导出失败'
      lastError.value = msg
      notify.error(msg)
    }
  }

  function exportText(content: string, filename: string): void {
    try {
      exportAsText(content, filename)
      notify.success(`已导出 ${filename}`)
    } catch (e) {
      const msg = (e as Error).message || '导出失败'
      lastError.value = msg
      notify.error(msg)
    }
  }

  function exportCSV(content: string, filename: string): void {
    try {
      exportAsCSV(content, filename)
      notify.success(`已导出 ${filename}`)
    } catch (e) {
      const msg = (e as Error).message || '导出失败'
      lastError.value = msg
      notify.error(msg)
    }
  }

  async function importJSONFile<T>(
    file: File,
    validator?: (data: unknown) => { valid: boolean; message?: string }
  ): Promise<{ valid: boolean; data?: T; message?: string }> {
    isProcessing.value = true
    lastError.value = null
    try {
      const text = await readFileAsText(file)
      const parsed = parseJSONSafe<T>(text)
      if (!parsed.valid) {
        lastError.value = parsed.message || 'JSON 解析失败'
        notify.warning(lastError.value)
        return { valid: false, message: lastError.value }
      }
      if (validator) {
        const vResult = validator(parsed.data)
        if (!vResult.valid) {
          lastError.value = vResult.message || '数据校验失败'
          notify.warning(lastError.value)
          return { valid: false, message: lastError.value }
        }
      }
      notify.success(`已导入 ${file.name}`)
      return { valid: true, data: parsed.data }
    } catch (e) {
      const msg = (e as Error).message || '导入失败'
      lastError.value = msg
      notify.error(msg)
      return { valid: false, message: msg }
    } finally {
      isProcessing.value = false
    }
  }

  async function importTextFile(
    file: File
  ): Promise<{ valid: boolean; content?: string; message?: string }> {
    isProcessing.value = true
    lastError.value = null
    try {
      const content = await readFileAsText(file)
      return { valid: true, content }
    } catch (e) {
      const msg = (e as Error).message || '文件读取失败'
      lastError.value = msg
      notify.error(msg)
      return { valid: false, message: msg }
    } finally {
      isProcessing.value = false
    }
  }

  function resetState(): void {
    isProcessing.value = false
    lastError.value = null
  }

  return {
    isProcessing,
    lastError,
    exportJSON,
    exportText,
    exportCSV,
    importJSONFile,
    importTextFile,
    resetState
  }
}
