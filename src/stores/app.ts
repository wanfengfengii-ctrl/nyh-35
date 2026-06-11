import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRegionStore } from './region'
import { useReviewStore } from './review'
import { useSpreadStore } from './spread'
import { useBookStore } from './book'
import { useIssueStore } from './issue'

export const useAppStore = defineStore('app', () => {
  const currentAuthor = ref('整理员')

  const regionStore = useRegionStore()
  const reviewStore = useReviewStore()
  const spreadStore = useSpreadStore()
  const bookStore = useBookStore()
  const issueStore = useIssueStore()

  const isSpreadMode = computed({
    get: () => spreadStore.isSpreadMode,
    set: (val: boolean) => {
      spreadStore.setSpreadMode(val)
      if (val) {
        regionStore.setCompareMode(false)
        bookStore.setBookBatchMode(false)
      }
    }
  })

  const isCompareMode = computed({
    get: () => regionStore.isCompareMode,
    set: (val: boolean) => {
      regionStore.setCompareMode(val)
      if (val) {
        spreadStore.setSpreadMode(false)
        bookStore.setBookBatchMode(false)
      }
    }
  })

  const isBookBatchMode = computed({
    get: () => bookStore.isBookBatchMode,
    set: (val: boolean) => {
      bookStore.setBookBatchMode(val)
      if (val) {
        regionStore.setCompareMode(false)
        spreadStore.setSpreadMode(false)
      }
    }
  })

  const isEditMode = computed(
    () => !regionStore.isCompareMode && !spreadStore.isSpreadMode && !bookStore.isBookBatchMode
  )

  function setEditMode(): void {
    regionStore.setCompareMode(false)
    spreadStore.setSpreadMode(false)
    bookStore.setBookBatchMode(false)
  }

  function clearAll(): void {
    regionStore.clearRegionData()
    reviewStore.clearReviewData()
    spreadStore.clearSpreadData()
    bookStore.clearBookData()
    issueStore.clearIssueData()
  }

  return {
    currentAuthor,
    isSpreadMode,
    isCompareMode,
    isBookBatchMode,
    isEditMode,
    setEditMode,
    clearAll
  }
})
