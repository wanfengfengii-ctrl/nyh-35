import { defineStore, storeToRefs } from 'pinia'
import { computed } from 'vue'
import {
  useRegionStore,
  useReviewStore,
  useSpreadStore,
  useBookStore,
  useIssueStore,
  useAppStore
} from '@/stores'
import { useSchemeStats } from '@/composables/useSchemeStats'
import type {
  Region,
  RegionCategory,
  ReviewDecision,
  SpreadLayout,
  AlignmentMethod,
  ProofreadingStatus,
  IssueStatus,
  ReviewResult,
  BookClosureReport
} from '@/types'

function pickActions<T extends object, K extends keyof T>(
  store: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>
  for (const k of keys) {
    result[k] = store[k]
  }
  return result
}

export const useMainStore = defineStore('main', () => {
  const regionStore = useRegionStore()
  const reviewStore = useReviewStore()
  const spreadStore = useSpreadStore()
  const bookStore = useBookStore()
  const issueStore = useIssueStore()
  const appStore = useAppStore()
  const { currentStats } = useSchemeStats()

  const author = computed(() => appStore.currentAuthor)

  const regionRefs = storeToRefs(regionStore)
  const reviewRefs = storeToRefs(reviewStore)
  const spreadRefs = storeToRefs(spreadStore)
  const bookRefs = storeToRefs(bookStore)
  const issueRefs = storeToRefs(issueStore)
  const appRefs = storeToRefs(appStore)

  function log(
    action: string,
    details: string,
    regionId: string | null = null,
    before: unknown | null = null,
    after: unknown | null = null
  ): void {
    reviewStore.addLog(action, details, regionId, before, after, author.value)
  }

  const currentScheme = computed(() => regionStore.currentScheme)
  const compareScheme = computed(() => regionStore.compareScheme)
  const regions = computed(() => regionStore.regions)
  const selectedRegion = computed(() => regionStore.selectedRegion)
  const sortedRegions = computed(() => regionStore.sortedRegions)
  const selectedCandidate = computed(() => regionStore.selectedCandidate)
  const pendingCandidates = computed(() => regionStore.pendingCandidates)
  const acceptedCandidates = computed(() => regionStore.acceptedCandidates)
  const unresolvedConflicts = computed(() => regionStore.unresolvedConflicts)

  const currentSchemeVersions = computed(() => reviewStore.currentSchemeVersions)
  const currentSchemeOpinions = computed(() => reviewStore.currentSchemeOpinions)
  const currentSchemeLogs = computed(() => reviewStore.currentSchemeLogs)

  const currentSpread = computed(() => spreadStore.currentSpread)
  const unresolvedBreaks = computed(() => spreadStore.unresolvedBreaks)
  const reviewedBreaks = computed(() => spreadStore.reviewedBreaks)
  const currentSpreadProofreading = computed(() => spreadStore.currentSpreadProofreading)

  const currentBook = computed(() => bookStore.currentBook)
  const currentBookSpreads = computed(() => bookStore.currentBookSpreads)
  const currentBookIssues = computed(() => bookStore.currentBookIssues)
  const filteredIssues = computed(() => issueStore.filteredIssues)
  const currentBookProgress = computed(() => bookStore.currentBookProgress)
  const currentIssue = computed(() => issueStore.currentIssue)
  const openIssuesCount = computed(() => bookStore.openIssuesCount)
  const highPriorityIssuesCount = computed(() => bookStore.highPriorityIssuesCount)

  function createScheme(name: string) {
    const scheme = regionStore.createScheme(name)
    scheme.author = author.value
    return scheme
  }

  function duplicateScheme(schemeId: string, newName: string) {
    const cloned = regionStore.duplicateScheme(schemeId, newName)
    if (cloned) cloned.author = author.value
    return cloned
  }

  function setCompareMode(enabled: boolean): void {
    appStore.isCompareMode = enabled
  }

  function setSpreadMode(enabled: boolean): void {
    appStore.isSpreadMode = enabled
  }

  function setBookBatchMode(enabled: boolean): void {
    appStore.isBookBatchMode = enabled
  }

  function clearAll(): void {
    appStore.clearAll()
  }

  function deleteTemplate(templateId: string): void {
    regionStore.deleteTemplate(templateId)
    log('删除模板', `删除模板`, null, null, null)
  }

  function runAutoRecognition() {
    const result = regionStore.runAutoRecognition()
    if (result.valid) {
      log('自动识别', `生成 ${regionStore.candidates.length} 个候选区域`)
    }
    return result
  }

  function acceptCandidate(candidateId: string) {
    const result = regionStore.acceptCandidate(candidateId)
    if (result.valid) {
      const c = regionStore.candidates.find((x) => x.id === candidateId)
      if (c) {
        log(
          '采纳候选',
          `采纳候选区域「${c.templateName}」创建区域（置信度 ${c.confidence}%）`,
          c.matchedRegionId
        )
      }
    }
    return result
  }

  function rejectCandidate(candidateId: string) {
    const result = regionStore.rejectCandidate(candidateId)
    if (result.valid) {
      const c = regionStore.candidates.find((x) => x.id === candidateId)
      if (c) {
        log(
          '拒绝候选',
          `拒绝候选区域「${c.templateName}」（置信度 ${c.confidence}%）`
        )
      }
    }
    return result
  }

  function acceptAllCandidates() {
    const result = regionStore.acceptAllCandidates()
    log(
      '批量采纳',
      `批量采纳 ${result.accepted}/${result.total} 个候选区域（置信度阈值 ${regionStore.confidenceThreshold}%）`
    )
    return result
  }

  function rejectAllCandidates(): number {
    const rejected = regionStore.rejectAllCandidates()
    log('批量拒绝', `批量拒绝 ${rejected} 个候选区域`)
    return rejected
  }

  function resolveConflict(conflictId: string) {
    const result = regionStore.resolveConflict(conflictId)
    if (result.valid) {
      const c = regionStore.conflicts.find((x) => x.id === conflictId)
      if (c) log('解决冲突', c.description)
    }
    return result
  }

  function addReviewOpinion(
    regionId: string,
    decision: ReviewDecision,
    comment: string,
    proposedChanges: Partial<Region> | null = null
  ) {
    return reviewStore.addReviewOpinion(
      regionId,
      decision,
      comment,
      proposedChanges,
      author.value
    )
  }

  function applyOpinionChanges(opinionId: string) {
    return reviewStore.applyOpinionChanges(opinionId, author.value)
  }

  function saveVersion(description: string = '') {
    return reviewStore.saveVersion(description, author.value)
  }

  function restoreVersion(versionId: string) {
    return reviewStore.restoreVersion(versionId, author.value)
  }

  function deleteVersion(versionId: string): void {
    reviewStore.deleteVersion(versionId, author.value)
  }

  function createSpread(name: string, layout: SpreadLayout) {
    return spreadStore.createSpread(name, layout, author.value)
  }

  function deleteSpread(spreadId: string): void {
    spreadStore.deleteSpread(spreadId, author.value)
  }

  function renameSpread(spreadId: string, newName: string): void {
    spreadStore.renameSpread(spreadId, newName, author.value)
  }

  async function addPageImageToSpread(spreadId: string, file: File) {
    return spreadStore.addPageImageToSpread(spreadId, file, author.value)
  }

  function removePageFromSpreadStore(spreadId: string, pageId: string): void {
    spreadStore.removePageFromSpreadStore(spreadId, pageId, author.value)
  }

  function runAutoAlignment(spreadId: string, method: AlignmentMethod) {
    return spreadStore.runAutoAlignment(spreadId, method, author.value)
  }

  function runBreakDetection(spreadId: string) {
    return spreadStore.runBreakDetection(spreadId, author.value)
  }

  function reviewBreak(
    breakId: string,
    comment: string,
    resolved: boolean
  ) {
    return spreadStore.reviewBreak(breakId, comment, resolved, author.value)
  }

  function startProofreading(spreadId: string) {
    return spreadStore.startProofreading(spreadId, author.value)
  }

  function finishProofreading(
    recordId: string,
    status: ProofreadingStatus,
    notes: string = ''
  ) {
    return spreadStore.finishProofreading(recordId, status, notes, author.value)
  }

  function generateSpreadReport(spreadId: string) {
    return spreadStore.generateSpreadReport(spreadId, author.value)
  }

  function addBook(
    name: string,
    totalPages: number,
    description: string = ''
  ) {
    return bookStore.addBook(name, totalPages, description, author.value)
  }

  function deleteBook(bookId: string): void {
    bookStore.deleteBook(bookId, author.value)
  }

  function generateBookSpreadsFromImages() {
    return bookStore.generateBookSpreadsFromImages(author.value)
  }

  function batchAlignBookSpreads(method: AlignmentMethod) {
    return bookStore.batchAlignBookSpreads(method, author.value)
  }

  function batchDetectBookBreaks() {
    return bookStore.batchDetectBookBreaks(author.value)
  }

  function assignIssueToUser(
    issueId: string,
    assignee: string,
    dueDate?: number
  ) {
    const result = issueStore.assignIssueToUser(issueId, assignee, dueDate)
    if (result.success) {
      const issue = issueStore.issues.find((i) => i.id === issueId)
      if (issue) {
        log('分配问题', `将问题「${issue.title}」分配给 ${assignee}`)
      }
    }
    return result
  }

  function batchAssignIssues(
    issueIds: string[],
    assignee: string,
    dueDate?: number
  ) {
    return issueStore.batchAssignIssues(issueIds, assignee, dueDate)
  }

  function updateIssueState(issueId: string, status: IssueStatus) {
    const result = issueStore.updateIssueState(issueId, status, author.value)
    if (result.success) {
      const issue = issueStore.issues.find((i) => i.id === issueId)
      if (issue) {
        log('更新问题状态', `问题「${issue.title}」状态已更新`)
      }
    }
    return result
  }

  function reviewIssueResult(
    issueId: string,
    result: ReviewResult,
    comment: string = ''
  ) {
    const res = issueStore.reviewIssueResult(
      issueId,
      result,
      comment,
      author.value
    )
    if (res.success) {
      const issue = issueStore.issues.find((i) => i.id === issueId)
      if (issue) {
        log(
          '复核问题',
          `问题「${issue.title}」复核完成${comment ? ' - ' + comment : ''}`
        )
      }
    }
    return res
  }

  function addIssueComment(issueId: string, content: string) {
    return issueStore.addIssueComment(issueId, content, author.value)
  }

  function generateBookReport() {
    return bookStore.generateBookReport(author.value)
  }

  function exportBookReport(
    report: BookClosureReport,
    format: 'text' | 'json' = 'text'
  ): string {
    return bookStore.exportBookReport(report, format)
  }

  function getNextRegionOrder(): number {
    return regionStore.getNextRegionOrder()
  }
  function getNextRegionName(category: RegionCategory): string {
    return regionStore.getNextRegionName(category)
  }

  const regionOnlyActions = pickActions(regionStore, [
    'loadPageImage',
    'switchScheme',
    'deleteScheme',
    'exportScheme',
    'importScheme',
    'addRegion',
    'updateRegion',
    'deleteRegion',
    'regionHasDescription',
    'selectRegion',
    'toggleRegionHidden',
    'setCompareScheme',
    'setDrawingMode',
    'setDrawingCategory',
    'renameScheme',
    'saveTemplateFromRegion',
    'clearCandidates',
    'refreshConflicts',
    'setAutoRecognitionMode',
    'setShowCandidates',
    'setShowConflicts',
    'setConfidenceThreshold',
    'selectCandidate'
  ] as const)
  const spreadOnlyActions = pickActions(spreadStore, [
    'setSpreadLayout',
    'setPageGap',
    'adjustPageOffset',
    'movePageInSpread',
    'selectBreak',
    'clearBreaks',
    'setShowBreakHighlights',
    'associateSchemeToPage',
    'switchSpread'
  ] as const)
  const bookOnlyActions = pickActions(bookStore, [
    'switchBook',
    'updateBook',
    'loadBookPageImages'
  ] as const)
  const issueOnlyActions = pickActions(issueStore, [
    'setIssueFilter',
    'selectIssue',
    'updateIssueDueDate',
    'updateIssuePriority'
  ] as const)
  const reviewOnlyActions = pickActions(reviewStore, [
    'getRegionOpinions',
    'getRegionMergedDecision',
    'finalizeRegion',
    'generateReport',
    'setReviewMode'
  ] as const)

  return {
    currentAuthor: appRefs.currentAuthor,
    pageImage: regionRefs.pageImage,
    schemes: regionRefs.schemes,
    currentSchemeId: regionRefs.currentSchemeId,
    selectedRegionId: regionRefs.selectedRegionId,
    compareSchemeId: regionRefs.compareSchemeId,
    isCompareMode: appRefs.isCompareMode,
    isDrawingMode: regionRefs.isDrawingMode,
    drawingCategory: regionRefs.drawingCategory,
    currentScheme,
    compareScheme,
    regions,
    selectedRegion,
    sortedRegions,
    currentStats,
    templates: regionRefs.templates,
    candidates: regionRefs.candidates,
    reviewOpinions: reviewRefs.reviewOpinions,
    conflicts: regionRefs.conflicts,
    reviewLogs: reviewRefs.reviewLogs,
    schemeVersions: reviewRefs.schemeVersions,
    isReviewMode: reviewRefs.isReviewMode,
    isAutoRecognitionMode: regionRefs.isAutoRecognitionMode,
    showCandidates: regionRefs.showCandidates,
    showConflicts: regionRefs.showConflicts,
    confidenceThreshold: regionRefs.confidenceThreshold,
    selectedCandidateId: regionRefs.selectedCandidateId,
    selectedCandidate,
    pendingCandidates,
    acceptedCandidates,
    unresolvedConflicts,
    currentSchemeVersions,
    currentSchemeOpinions,
    currentSchemeLogs,
    spreads: spreadRefs.spreads,
    currentSpreadId: spreadRefs.currentSpreadId,
    isSpreadMode: appRefs.isSpreadMode,
    spreadBreaks: spreadRefs.spreadBreaks,
    proofreadingRecords: spreadRefs.proofreadingRecords,
    selectedBreakId: spreadRefs.selectedBreakId,
    showBreakHighlights: spreadRefs.showBreakHighlights,
    lastAlignmentResult: spreadRefs.lastAlignmentResult,
    currentSpread,
    unresolvedBreaks,
    reviewedBreaks,
    currentSpreadProofreading,
    books: bookRefs.books,
    currentBookId: bookRefs.currentBookId,
    bookSpreads: bookRefs.bookSpreads,
    issues: issueRefs.issues,
    isBookBatchMode: appRefs.isBookBatchMode,
    currentIssueId: issueRefs.currentIssueId,
    issueFilter: issueRefs.issueFilter,
    bookPageImages: bookRefs.bookPageImages,
    currentBook,
    currentBookSpreads,
    currentBookIssues,
    filteredIssues,
    currentBookProgress,
    currentIssue,
    openIssuesCount,
    highPriorityIssuesCount,

    getNextRegionOrder,
    getNextRegionName,
    loadPageImage: regionOnlyActions.loadPageImage,
    createScheme,
    switchScheme: regionOnlyActions.switchScheme,
    deleteScheme: regionOnlyActions.deleteScheme,
    duplicateScheme,
    exportScheme: regionOnlyActions.exportScheme,
    importScheme: regionOnlyActions.importScheme,
    addRegion: regionOnlyActions.addRegion,
    updateRegion: regionOnlyActions.updateRegion,
    deleteRegion: regionOnlyActions.deleteRegion,
    regionHasDescription: regionOnlyActions.regionHasDescription,
    selectRegion: regionOnlyActions.selectRegion,
    toggleRegionHidden: regionOnlyActions.toggleRegionHidden,
    setCompareMode,
    setCompareScheme: regionOnlyActions.setCompareScheme,
    setDrawingMode: regionOnlyActions.setDrawingMode,
    setDrawingCategory: regionOnlyActions.setDrawingCategory,
    renameScheme: regionOnlyActions.renameScheme,
    clearAll,
    addLog: log,
    saveTemplateFromRegion: regionOnlyActions.saveTemplateFromRegion,
    deleteTemplate,
    runAutoRecognition,
    acceptCandidate,
    rejectCandidate,
    acceptAllCandidates,
    rejectAllCandidates,
    clearCandidates: regionOnlyActions.clearCandidates,
    refreshConflicts: regionOnlyActions.refreshConflicts,
    resolveConflict,
    addReviewOpinion,
    getRegionOpinions: reviewOnlyActions.getRegionOpinions,
    getRegionMergedDecision: reviewOnlyActions.getRegionMergedDecision,
    applyOpinionChanges,
    finalizeRegion: reviewOnlyActions.finalizeRegion,
    saveVersion,
    restoreVersion,
    deleteVersion,
    generateReport: reviewOnlyActions.generateReport,
    setReviewMode: reviewOnlyActions.setReviewMode,
    setAutoRecognitionMode: regionOnlyActions.setAutoRecognitionMode,
    setShowCandidates: regionOnlyActions.setShowCandidates,
    setShowConflicts: regionOnlyActions.setShowConflicts,
    setConfidenceThreshold: regionOnlyActions.setConfidenceThreshold,
    selectCandidate: regionOnlyActions.selectCandidate,
    createSpread,
    switchSpread: spreadOnlyActions.switchSpread,
    deleteSpread,
    renameSpread,
    setSpreadMode,
    setSpreadLayout: spreadOnlyActions.setSpreadLayout,
    setPageGap: spreadOnlyActions.setPageGap,
    addPageImageToSpread,
    removePageFromSpreadStore,
    adjustPageOffset: spreadOnlyActions.adjustPageOffset,
    movePageInSpread: spreadOnlyActions.movePageInSpread,
    runAutoAlignment,
    runBreakDetection,
    selectBreak: spreadOnlyActions.selectBreak,
    reviewBreak,
    clearBreaks: spreadOnlyActions.clearBreaks,
    setShowBreakHighlights: spreadOnlyActions.setShowBreakHighlights,
    startProofreading,
    finishProofreading,
    generateSpreadReport,
    associateSchemeToPage: spreadOnlyActions.associateSchemeToPage,
    addBook,
    deleteBook,
    switchBook: bookOnlyActions.switchBook,
    updateBook: bookOnlyActions.updateBook,
    loadBookPageImages: bookOnlyActions.loadBookPageImages,
    generateBookSpreadsFromImages,
    batchAlignBookSpreads,
    batchDetectBookBreaks,
    assignIssueToUser,
    batchAssignIssues,
    updateIssueState,
    reviewIssueResult,
    addIssueComment,
    setIssueFilter: issueOnlyActions.setIssueFilter,
    selectIssue: issueOnlyActions.selectIssue,
    setBookBatchMode,
    generateBookReport,
    exportBookReport,
    updateIssueDueDate: issueOnlyActions.updateIssueDueDate,
    updateIssuePriority: issueOnlyActions.updateIssuePriority
  }
})
