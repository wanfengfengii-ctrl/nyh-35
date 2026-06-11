import { ref, computed, watch } from 'vue'
import { useRegionStore } from '@/stores/region'
import { useSpreadStore } from '@/stores/spread'
import { useBookStore } from '@/stores/book'

export type WorkMode = 'edit' | 'compare' | 'spread' | 'bookBatch'

export function useModeSwitch() {
  const regionStore = useRegionStore()
  const spreadStore = useSpreadStore()
  const bookStore = useBookStore()

  const _internalMode = ref<WorkMode>('edit')

  const currentMode = computed<WorkMode>({
    get: () => {
      if (bookStore.isBookBatchMode) return 'bookBatch'
      if (spreadStore.isSpreadMode) return 'spread'
      if (regionStore.isCompareMode) return 'compare'
      return 'edit'
    },
    set: (mode: WorkMode) => {
      switchMode(mode)
    }
  })

  const isEditMode = computed(() => currentMode.value === 'edit')
  const isCompareMode = computed(() => currentMode.value === 'compare')
  const isSpreadMode = computed(() => currentMode.value === 'spread')
  const isBookBatchMode = computed(() => currentMode.value === 'bookBatch')

  function switchMode(mode: WorkMode): void {
    regionStore.setCompareMode(false)
    spreadStore.setSpreadMode(false)
    bookStore.setBookBatchMode(false)

    switch (mode) {
      case 'compare':
        regionStore.setCompareMode(true)
        break
      case 'spread':
        spreadStore.setSpreadMode(true)
        break
      case 'bookBatch':
        bookStore.setBookBatchMode(true)
        break
      case 'edit':
      default:
        break
    }
    _internalMode.value = mode
  }

  function toEditMode(): void {
    switchMode('edit')
  }
  function toCompareMode(): void {
    switchMode('compare')
  }
  function toSpreadMode(): void {
    switchMode('spread')
  }
  function toBookBatchMode(): void {
    switchMode('bookBatch')
  }

  watch(
    () => bookStore.isBookBatchMode,
    (val) => {
      if (val) _internalMode.value = 'bookBatch'
    }
  )
  watch(
    () => spreadStore.isSpreadMode,
    (val) => {
      if (val) _internalMode.value = 'spread'
    }
  )
  watch(
    () => regionStore.isCompareMode,
    (val) => {
      if (val) _internalMode.value = 'compare'
    }
  )

  return {
    currentMode,
    isEditMode,
    isCompareMode,
    isSpreadMode,
    isBookBatchMode,
    switchMode,
    toEditMode,
    toCompareMode,
    toSpreadMode,
    toBookBatchMode
  }
}
