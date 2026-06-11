import { ref } from 'vue'
import { readFileAsText, readFileAsDataURL, loadImageFromDataURL } from '@/utils/common'

export function useFileUpload() {
  const isUploading = ref(false)
  const uploadError = ref<string | null>(null)

  async function uploadTextFile(file: File): Promise<string | null> {
    isUploading.value = true
    uploadError.value = null
    try {
      const content = await readFileAsText(file)
      return content
    } catch (e) {
      uploadError.value = (e as Error).message
      return null
    } finally {
      isUploading.value = false
    }
  }

  async function uploadImageFile(file: File): Promise<{
    dataUrl: string
    width: number
    height: number
  } | null> {
    isUploading.value = true
    uploadError.value = null
    try {
      const dataUrl = await readFileAsDataURL(file)
      const img = await loadImageFromDataURL(dataUrl)
      return { dataUrl, width: img.width, height: img.height }
    } catch (e) {
      uploadError.value = (e as Error).message
      return null
    } finally {
      isUploading.value = false
    }
  }

  async function uploadMultipleImageFiles(files: File[]): Promise<
    Array<{ dataUrl: string; width: number; height: number; name: string }>
  > {
    isUploading.value = true
    uploadError.value = null
    const results: Array<{ dataUrl: string; width: number; height: number; name: string }> = []

    for (let i = 0; i < files.length; i++) {
      try {
        const file = files[i]
        const dataUrl = await readFileAsDataURL(file)
        const img = await loadImageFromDataURL(dataUrl)
        results[i] = { dataUrl, width: img.width, height: img.height, name: file.name }
      } catch {
      }
    }

    isUploading.value = false
    return results.filter(Boolean)
  }

  function resetUploadState(): void {
    isUploading.value = false
    uploadError.value = null
  }

  return {
    isUploading,
    uploadError,
    uploadTextFile,
    uploadImageFile,
    uploadMultipleImageFiles,
    resetUploadState
  }
}
