import { computed, ref, watch } from 'vue'
import { useMainStore } from '@/stores/main'
import { useModeSwitch } from './useModeSwitch'
import { useNotify } from './useNotify'

export type ActiveTab = 'list' | 'auto' | 'review' | 'conflict' | 'version' | 'log' | 'scheme' | 'stats' | 'report' | 'spread' | 'batch' | 'issue' | 'dashboard'

export function useAppLayout() {
  const store = useMainStore()
  const { info, warning, success, error } = useNotify()

  const { currentMode } = useModeSwitch()

  const canvasKey = ref(0)
  const compareCanvasKey = ref(0)
  const spreadCanvasKey = ref(0)
  const activeTab = ref<ActiveTab>('list')

  watch(
    () => store.currentSchemeId,
    () => {
      canvasKey.value++
    }
  )

  watch(
    () => store.compareSchemeId,
    () => {
      compareCanvasKey.value++
    }
  )

  watch(
    () => store.currentSpreadId,
    () => {
      spreadCanvasKey.value++
    }
  )

  watch(
    () => store.isSpreadMode,
    (val) => {
      if (val) {
        activeTab.value = 'spread'
      } else if (activeTab.value === 'spread') {
        activeTab.value = 'list'
      }
    }
  )

  watch(
    () => store.isBookBatchMode,
    (val) => {
      if (val) {
        activeTab.value = 'dashboard'
      } else if (['batch', 'issue', 'dashboard'].includes(activeTab.value)) {
        activeTab.value = 'list'
      }
    }
  )

  const hasImage = computed(() => !!store.pageImage)
  const hasRegions = computed(() => store.regions.length > 0)
  const hasSpread = computed(() => !!store.currentSpread)
  const hasBook = computed(() => !!store.currentBook)
  const hasBookData = computed(() => store.books.length > 0)

  function handleAddRegion(position: { x: number; y: number; width: number; height: number }) {
    const result = store.addRegion(position, store.drawingCategory)
    if (!result.valid) {
      warning(result.message)
    }
  }

  function handleSelectRegion(id: string | null) {
    store.selectRegion(id)
  }

  function handleUpdatePosition(id: string, position: { x: number; y: number; width: number; height: number }) {
    const result = store.updateRegion(id, { position })
    if (!result.valid) {
      warning(result.message)
    }
  }

  function handleSelectCandidate(candidateId: string) {
    store.selectCandidate(candidateId)
    const candidate = store.selectedCandidate
    if (candidate) {
      info(`已选中候选：${candidate.templateName}（置信度 ${candidate.confidence}%）`)
    }
  }

  function handleSelectBreak(breakId: string | null) {
    store.selectBreak(breakId)
  }

  function handleAdjustPageOffset(pageId: string, offset: { offsetX?: number; offsetY?: number }) {
    if (!store.currentSpreadId) return
    store.adjustPageOffset(store.currentSpreadId, pageId, offset)
  }

  return {
    store,
    currentMode,
    canvasKey,
    compareCanvasKey,
    spreadCanvasKey,
    activeTab,
    hasImage,
    hasRegions,
    hasSpread,
    hasBook,
    hasBookData,
    handleAddRegion,
    handleSelectRegion,
    handleUpdatePosition,
    handleSelectCandidate,
    handleSelectBreak,
    handleAdjustPageOffset,
    info,
    warning,
    success,
    error
  }
}
