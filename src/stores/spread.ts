import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import {
  SpreadView,
  SpreadLayout,
  PageOffset,
  AlignmentResult,
  AlignmentMethod,
  BreakRegion,
  ProofreadingRecord,
  ProofreadingStatus,
  SpreadConsistencyReport,
  PageImage,
  SplitScheme,
  ValidationResult
} from '@/types'
import {
  createSpreadView,
  addPageToSpread,
  removePageFromSpread,
  updatePageOffset,
  reorderPages,
  autoAlignSpread
} from '@/utils/spreadAlignment'
import { detectAllBreaks, reviewBreakRegion } from '@/utils/breakDetection'
import {
  createProofreadingRecord,
  updateProofreadingStatus,
  updateProofreadingNotes,
  generateSpreadConsistencyReport
} from '@/utils/proofreadingReport'
import { cloneSplitScheme } from '@/utils/validators'
import { loadPageImageFromFile } from '@/utils/common'
import { useReviewStore } from './review'

export interface SpreadDeps {
  addLog?: (action: string, details: string, regionId?: string | null, before?: unknown | null, after?: unknown | null, author?: string) => void
}

export const useSpreadStore = defineStore('spread', () => {
  const spreads = ref<SpreadView[]>([])
  const currentSpreadId = ref<string | null>(null)
  const isSpreadMode = ref(false)
  const spreadBreaks = ref<BreakRegion[]>([])
  const proofreadingRecords = ref<ProofreadingRecord[]>([])
  const selectedBreakId = ref<string | null>(null)
  const showBreakHighlights = ref(true)
  const lastAlignmentResult = ref<AlignmentResult | null>(null)

  function getDefaultDeps(): Required<SpreadDeps> {
    const reviewStore = useReviewStore()
    return {
      addLog: (action, details, regionId = null, before = null, after = null, author = '整理员') =>
        reviewStore.addLog(action, details, regionId, before, after, author)
    }
  }

  function withDeps(deps?: Partial<SpreadDeps>): Required<SpreadDeps> {
    return { ...getDefaultDeps(), ...deps }
  }

  const currentSpread = computed<SpreadView | null>(() => {
    if (!currentSpreadId.value) return null
    return spreads.value.find((s) => s.id === currentSpreadId.value) || null
  })

  const unresolvedBreaks = computed(() => spreadBreaks.value.filter((b) => !b.resolved))

  const reviewedBreaks = computed(() => spreadBreaks.value.filter((b) => b.reviewed))

  const currentSpreadProofreading = computed<ProofreadingRecord | null>(() => {
    if (!currentSpreadId.value) return null
    return (
      proofreadingRecords.value
        .filter((r) => r.spreadId === currentSpreadId.value)
        .sort((a, b) => b.startTime - a.startTime)[0] || null
    )
  })

  function createSpread(
    name: string,
    layout: SpreadLayout = SpreadLayout.RIGHT_LEFT,
    author: string = '整理员',
    deps?: Partial<SpreadDeps>
  ): SpreadView {
    const d = withDeps(deps)
    const spread = createSpreadView(name, layout)
    spreads.value.push(spread)
    currentSpreadId.value = spread.id
    d.addLog('创建跨页', `创建跨页视图「${name}」`, null, null, null, author)
    return spread
  }

  function switchSpread(spreadId: string): void {
    const spread = spreads.value.find((s) => s.id === spreadId)
    if (spread) {
      currentSpreadId.value = spreadId
      spreadBreaks.value = []
      selectedBreakId.value = null
    }
  }

  function deleteSpread(
    spreadId: string,
    author: string = '整理员',
    deps?: Partial<SpreadDeps>
  ): void {
    const d = withDeps(deps)
    const idx = spreads.value.findIndex((s) => s.id === spreadId)
    if (idx === -1) return
    const name = spreads.value[idx].name
    spreads.value.splice(idx, 1)
    if (currentSpreadId.value === spreadId) {
      currentSpreadId.value = spreads.value.length > 0 ? spreads.value[0].id : null
      spreadBreaks.value = []
    }
    proofreadingRecords.value = proofreadingRecords.value.filter((r) => r.spreadId !== spreadId)
    d.addLog('删除跨页', `删除跨页视图「${name}」`, null, null, null, author)
  }

  function renameSpread(
    spreadId: string,
    newName: string,
    author: string = '整理员',
    deps?: Partial<SpreadDeps>
  ): void {
    const d = withDeps(deps)
    const spread = spreads.value.find((s) => s.id === spreadId)
    if (spread) {
      const oldName = spread.name
      spread.name = newName
      spread.updatedAt = Date.now()
      d.addLog('重命名跨页', `跨页「${oldName}」更名为「${newName}」`, null, null, null, author)
    }
  }

  function setSpreadMode(enabled: boolean): void {
    isSpreadMode.value = enabled
    if (!enabled) {
      selectedBreakId.value = null
    }
  }

  function setSpreadLayout(spreadId: string, layout: SpreadLayout): void {
    const spread = spreads.value.find((s) => s.id === spreadId)
    if (spread) {
      spread.layout = layout
      spread.updatedAt = Date.now()
    }
  }

  function setPageGap(spreadId: string, gap: number): void {
    const spread = spreads.value.find((s) => s.id === spreadId)
    if (spread) {
      spread.pageGap = Math.max(0, gap)
      spread.updatedAt = Date.now()
    }
  }

  async function addPageImageToSpread(
    spreadId: string,
    file: File,
    author: string = '整理员',
    deps?: Partial<SpreadDeps>
  ): Promise<ValidationResult> {
    const d = withDeps(deps)
    const { dataUrl, width, height } = await loadPageImageFromFile(file)
    const spread = spreads.value.find((s) => s.id === spreadId)
    if (!spread) {
      return { valid: false, message: '跨页视图不存在' }
    }
    const pageImage: PageImage = {
      id: uuidv4(),
      name: file.name,
      dataUrl,
      width,
      height
    }
    const updated = addPageToSpread(spread, pageImage, null)
    const idx = spreads.value.findIndex((s) => s.id === spreadId)
    if (idx !== -1) {
      spreads.value[idx] = updated
    }
    d.addLog('添加书页', `向跨页「${spread.name}」添加书页「${file.name}」`, null, null, null, author)
    return { valid: true, message: '书页已添加' }
  }

  function removePageFromSpreadStore(
    spreadId: string,
    pageId: string,
    author: string = '整理员',
    deps?: Partial<SpreadDeps>
  ): void {
    const d = withDeps(deps)
    const spread = spreads.value.find((s) => s.id === spreadId)
    if (!spread) return
    const page = spread.pages.find((p) => p.pageId === pageId)
    const updated = removePageFromSpread(spread, pageId)
    const idx = spreads.value.findIndex((s) => s.id === spreadId)
    if (idx !== -1) {
      spreads.value[idx] = updated
    }
    if (page) {
      d.addLog('移除书页', `从跨页「${spread.name}」移除书页「${page.image.name}」`, null, null, null, author)
    }
  }

  function adjustPageOffset(
    spreadId: string,
    pageId: string,
    offset: Partial<PageOffset>
  ): void {
    const spread = spreads.value.find((s) => s.id === spreadId)
    if (!spread) return
    const updated = updatePageOffset(spread, pageId, offset)
    const idx = spreads.value.findIndex((s) => s.id === spreadId)
    if (idx !== -1) {
      spreads.value[idx] = updated
    }
  }

  function movePageInSpread(spreadId: string, fromIndex: number, toIndex: number): void {
    const spread = spreads.value.find((s) => s.id === spreadId)
    if (!spread) return
    const updated = reorderPages(spread, fromIndex, toIndex)
    const idx = spreads.value.findIndex((s) => s.id === spreadId)
    if (idx !== -1) {
      spreads.value[idx] = updated
    }
  }

  function runAutoAlignment(
    spreadId: string,
    method: AlignmentMethod = AlignmentMethod.BLOCK_CENTER,
    author: string = '整理员',
    deps?: Partial<SpreadDeps>
  ): ValidationResult {
    const d = withDeps(deps)
    const spread = spreads.value.find((s) => s.id === spreadId)
    if (!spread) return { valid: false, message: '跨页视图不存在' }
    if (spread.pages.length < 2) {
      return { valid: false, message: '请先添加至少两页书页' }
    }
    const result = autoAlignSpread(spread, method)
    if (!result.success) {
      lastAlignmentResult.value = result
      return { valid: false, message: result.details }
    }
    const idx = spreads.value.findIndex((s) => s.id === spreadId)
    if (idx !== -1) {
      spreads.value[idx] = result.updatedSpread
    }
    lastAlignmentResult.value = result
    d.addLog('自动对齐', `跨页「${spread.name}」对齐完成，置信度${result.confidence}%：${result.details}`, null, null, null, author)
    return { valid: true, message: `对齐完成，置信度 ${result.confidence}%` }
  }

  function runBreakDetection(
    spreadId: string,
    author: string = '整理员',
    deps?: Partial<SpreadDeps>
  ): ValidationResult & { count?: number } {
    const d = withDeps(deps)
    const spread = spreads.value.find((s) => s.id === spreadId)
    if (!spread) return { valid: false, message: '跨页视图不存在' }
    if (spread.pages.length < 2) {
      return { valid: false, message: '请先添加至少两页书页' }
    }
    const breaks = detectAllBreaks(spread)
    spreadBreaks.value = breaks
    d.addLog('断裂检测', `跨页「${spread.name}」检测到 ${breaks.length} 个潜在问题`, null, null, null, author)
    return { valid: true, message: `检测到 ${breaks.length} 个潜在问题`, count: breaks.length }
  }

  function selectBreak(breakId: string | null): void {
    selectedBreakId.value = breakId
  }

  function reviewBreak(
    breakId: string,
    comment: string,
    resolved: boolean,
    author: string = '整理员',
    deps?: Partial<SpreadDeps>
  ): ValidationResult {
    const d = withDeps(deps)
    const idx = spreadBreaks.value.findIndex((b) => b.id === breakId)
    if (idx === -1) return { valid: false, message: '断裂区域不存在' }
    spreadBreaks.value[idx] = reviewBreakRegion(
      spreadBreaks.value[idx],
      author,
      comment,
      resolved
    )
    d.addLog('校对断裂', `${resolved ? '标记已解决' : '标记待处理'}：${spreadBreaks.value[idx].description}${comment ? ' - ' + comment : ''}`, null, null, null, author)
    return { valid: true, message: resolved ? '已标记为已解决' : '已标记为待处理' }
  }

  function clearBreaks(): void {
    spreadBreaks.value = []
    selectedBreakId.value = null
  }

  function setShowBreakHighlights(enabled: boolean): void {
    showBreakHighlights.value = enabled
  }

  function startProofreading(
    spreadId: string,
    author: string = '整理员',
    deps?: Partial<SpreadDeps>
  ): ProofreadingRecord {
    const d = withDeps(deps)
    const record = createProofreadingRecord(spreadId, author)
    proofreadingRecords.value.push(record)
    d.addLog('开始校对', `开始跨页校对`, null, null, null, author)
    return record
  }

  function finishProofreading(
    recordId: string,
    status: ProofreadingStatus,
    notes: string = '',
    author: string = '整理员',
    deps?: Partial<SpreadDeps>
  ): ValidationResult {
    const d = withDeps(deps)
    const idx = proofreadingRecords.value.findIndex((r) => r.id === recordId)
    if (idx === -1) return { valid: false, message: '校对记录不存在' }
    let record = proofreadingRecords.value[idx]
    if (notes) {
      record = updateProofreadingNotes(record, notes)
    }
    record = updateProofreadingStatus(record, status, author)
    proofreadingRecords.value[idx] = record
    d.addLog('完成校对', `校对状态更新完成${notes ? '：' + notes : ''}`, null, null, null, author)
    return { valid: true, message: '校对记录已更新' }
  }

  function generateSpreadReport(
    spreadId: string,
    author: string = '整理员',
    deps?: Partial<SpreadDeps>
  ): SpreadConsistencyReport | null {
    const d = withDeps(deps)
    const spread = spreads.value.find((s) => s.id === spreadId)
    if (!spread) return null
    const report = generateSpreadConsistencyReport(
      spread,
      spreadBreaks.value,
      currentSpreadProofreading.value,
      author,
      lastAlignmentResult.value?.confidence || 0
    )
    d.addLog('生成报告', `生成跨页「${spread.name}」一致性报告（${report.totalIssues} 个问题）`, null, null, null, author)
    return report
  }

  function associateSchemeToPage(
    spreadId: string,
    pageId: string,
    scheme: SplitScheme
  ): void {
    const spread = spreads.value.find((s) => s.id === spreadId)
    if (!spread) return
    const pageIdx = spread.pages.findIndex((p) => p.pageId === pageId)
    if (pageIdx !== -1) {
      spread.pages[pageIdx].scheme = cloneSplitScheme(scheme)
      spread.updatedAt = Date.now()
    }
  }

  function clearSpreadData(): void {
    spreads.value = []
    currentSpreadId.value = null
    isSpreadMode.value = false
    spreadBreaks.value = []
    proofreadingRecords.value = []
    selectedBreakId.value = null
    lastAlignmentResult.value = null
  }

  return {
    spreads,
    currentSpreadId,
    isSpreadMode,
    spreadBreaks,
    proofreadingRecords,
    selectedBreakId,
    showBreakHighlights,
    lastAlignmentResult,
    currentSpread,
    unresolvedBreaks,
    reviewedBreaks,
    currentSpreadProofreading,
    createSpread,
    switchSpread,
    deleteSpread,
    renameSpread,
    setSpreadMode,
    setSpreadLayout,
    setPageGap,
    addPageImageToSpread,
    removePageFromSpreadStore,
    adjustPageOffset,
    movePageInSpread,
    runAutoAlignment,
    runBreakDetection,
    selectBreak,
    reviewBreak,
    clearBreaks,
    setShowBreakHighlights,
    startProofreading,
    finishProofreading,
    generateSpreadReport,
    associateSchemeToPage,
    clearSpreadData
  }
})
