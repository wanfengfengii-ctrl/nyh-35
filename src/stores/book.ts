import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import {
  Book,
  BookSpread,
  BookStatus,
  BookProgress,
  BookClosureReport,
  PageImage,
  SpreadLayout,
  SplitScheme,
  AlignmentMethod,
  Issue
} from '@/types'
import {
  createBook,
  generateBookSpreads,
  batchAlignSpreads,
  batchDetectBreaks,
  calculateBookProgress,
  generateBookClosureReport,
  exportClosureReportAsText
} from '@/utils/batchProcessing'
import { loadPageImageFromFile } from '@/utils/common'
import { useSpreadStore } from './spread'
import { useIssueStore } from './issue'
import { useReviewStore } from './review'

export interface BookDeps {
  addLog?: (action: string, details: string, regionId?: string | null, before?: unknown | null, after?: unknown | null, author?: string) => void
  getSpreads?: () => any[]
  setSpread?: (spread: any) => void
  removeIssuesByBook?: (bookId: string) => void
  createIssuesFromBreaksMap?: (breaksMap: Map<string, any[]>, bookId: string, author: string, bookSpreads: BookSpread[]) => Issue[]
  getIssuesByBook?: (bookId: string) => Issue[]
}

export const useBookStore = defineStore('book', () => {
  const books = ref<Book[]>([])
  const currentBookId = ref<string | null>(null)
  const bookSpreads = ref<BookSpread[]>([])
  const isBookBatchMode = ref(false)
  const bookPageImages = ref<PageImage[]>([])

  function getDefaultDeps(): Required<BookDeps> {
    const spreadStore = useSpreadStore()
    const issueStore = useIssueStore()
    const reviewStore = useReviewStore()
    return {
      addLog: (action, details, regionId = null, before = null, after = null, author = '整理员') =>
        reviewStore.addLog(action, details, regionId, before, after, author),
      getSpreads: () => spreadStore.spreads,
      setSpread: (spread: any) => {
        const idx = spreadStore.spreads.findIndex((s: any) => s.id === spread.id)
        if (idx !== -1) spreadStore.spreads[idx] = spread
        else spreadStore.spreads.push(spread)
      },
      removeIssuesByBook: (bookId: string) => issueStore.removeIssuesByBook(bookId),
      createIssuesFromBreaksMap: (breaksMap, bookId, author, bs) =>
        issueStore.createIssuesFromBreaksMap(breaksMap, bookId, author, bs),
      getIssuesByBook: (bookId: string) => issueStore.getIssuesByBook(bookId)
    }
  }

  function withDeps(deps?: Partial<BookDeps>): Required<BookDeps> {
    return { ...getDefaultDeps(), ...deps }
  }

  const currentBook = computed<Book | null>(() => {
    if (!currentBookId.value) return null
    return books.value.find((b) => b.id === currentBookId.value) || null
  })

  const currentBookSpreads = computed<BookSpread[]>(() => {
    if (!currentBookId.value) return []
    return bookSpreads.value
      .filter((bs) => bs.bookId === currentBookId.value)
      .sort((a, b) => a.sequence - b.sequence)
  })

  const currentBookIssues = computed(() => {
    const d = getDefaultDeps()
    return d.getIssuesByBook(currentBookId.value || '')
  })

  const currentBookProgress = computed<BookProgress | null>(() => {
    if (!currentBook.value) return null
    return calculateBookProgress(
      currentBook.value,
      currentBookSpreads.value,
      currentBookIssues.value
    )
  })

  const openIssuesCount = computed(() =>
    currentBookIssues.value.filter((i) => i.status === 'open').length
  )

  const highPriorityIssuesCount = computed(() =>
    currentBookIssues.value.filter(
      (i) => i.priority === 'high' || i.priority === 'urgent'
    ).length
  )

  function addBook(
    name: string,
    totalPages: number,
    description: string = '',
    author: string = '整理员',
    deps?: Partial<BookDeps>
  ): Book {
    const d = withDeps(deps)
    const book = createBook(
      name,
      author,
      totalPages,
      1,
      undefined,
      SpreadLayout.RIGHT_LEFT,
      description
    )
    books.value.push(book)
    currentBookId.value = book.id
    d.addLog('创建书籍', `创建整册项目「${name}」，共 ${totalPages} 页`, null, null, null, author)
    return book
  }

  function deleteBook(
    bookId: string,
    author: string = '整理员',
    deps?: Partial<BookDeps>
  ): void {
    const d = withDeps(deps)
    const idx = books.value.findIndex((b) => b.id === bookId)
    if (idx === -1) return
    const name = books.value[idx].name
    books.value.splice(idx, 1)
    bookSpreads.value = bookSpreads.value.filter((bs) => bs.bookId !== bookId)
    d.removeIssuesByBook(bookId)
    if (currentBookId.value === bookId) {
      currentBookId.value = books.value.length > 0 ? books.value[0].id : null
    }
    d.addLog('删除书籍', `删除整册项目「${name}」`, null, null, null, author)
  }

  function switchBook(bookId: string): void {
    const book = books.value.find((b) => b.id === bookId)
    if (book) {
      currentBookId.value = bookId
    }
  }

  function updateBook(bookId: string, updates: Partial<Book>): void {
    const book = books.value.find((b) => b.id === bookId)
    if (!book) return
    Object.assign(book, updates)
    book.updatedAt = Date.now()
  }

  async function loadBookPageImages(files: File[]): Promise<void> {
    const loaded: PageImage[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const { dataUrl, width, height } = await loadPageImageFromFile(file)
        loaded[i] = {
          id: uuidv4(),
          name: file.name,
          dataUrl,
          width,
          height
        }
      } catch {
      }
    }

    bookPageImages.value = loaded.filter(Boolean)
  }

  function generateBookSpreadsFromImages(
    author: string = '整理员',
    deps?: Partial<BookDeps>
  ): { success: boolean; message: string; count: number } {
    const d = withDeps(deps)
    if (!currentBook.value) {
      return { success: false, message: '请先选择整册项目', count: 0 }
    }
    if (bookPageImages.value.length < 2) {
      return { success: false, message: '至少需要 2 页书页图像', count: 0 }
    }

    const schemesMap = new Map<string, SplitScheme>()
    const { spreads: newSpreads, bookSpreads: newBookSpreads } = generateBookSpreads(
      currentBook.value,
      bookPageImages.value,
      schemesMap
    )

    for (const s of newSpreads) {
      d.setSpread(s)
    }
    for (const bs of newBookSpreads) {
      bookSpreads.value.push(bs)
    }

    if (currentBook.value) {
      currentBook.value.status = BookStatus.IN_PROGRESS
      currentBook.value.totalPages = bookPageImages.value.length
      currentBook.value.updatedAt = Date.now()
    }

    d.addLog('批量生成跨页', `为整册「${currentBook.value.name}」生成 ${newSpreads.length} 个跨页视图`, null, null, null, author)
    return {
      success: true,
      message: `成功生成 ${newSpreads.length} 个跨页视图`,
      count: newSpreads.length
    }
  }

  function batchAlignBookSpreads(
    method: AlignmentMethod,
    author: string = '整理员',
    deps?: Partial<BookDeps>
  ): { success: boolean; message: string; processed: number; failed: number } {
    const d = withDeps(deps)
    if (!currentBook.value || currentBookSpreads.value.length === 0) {
      return { success: false, message: '没有可处理的跨页', processed: 0, failed: 0 }
    }

    const spreadIds = currentBookSpreads.value.map((bs) => bs.spreadId)
    const allSpreads = d.getSpreads()
    const targetSpreads = allSpreads.filter((s: any) => spreadIds.includes(s.id))

    const { results, summary } = batchAlignSpreads(targetSpreads, method)

    for (const result of results) {
      d.setSpread(result.updatedSpread)
      const bsIdx = bookSpreads.value.findIndex((bs) => bs.spreadId === result.updatedSpread.id)
      if (bsIdx !== -1) {
        bookSpreads.value[bsIdx].alignmentConfidence = result.confidence
        bookSpreads.value[bsIdx].updatedAt = Date.now()
      }
    }

    d.addLog('批量对齐', `整册「${currentBook.value.name}」批量对齐：${summary.message}`, null, null, null, author)
    return {
      success: summary.success,
      message: summary.message,
      processed: summary.processed,
      failed: summary.failed
    }
  }

  function batchDetectBookBreaks(
    author: string = '整理员',
    deps?: Partial<BookDeps>
  ): { success: boolean; message: string; totalIssues: number } {
    const d = withDeps(deps)
    if (!currentBook.value || currentBookSpreads.value.length === 0) {
      return { success: false, message: '没有可处理的跨页', totalIssues: 0 }
    }

    const spreadIds = currentBookSpreads.value.map((bs) => bs.spreadId)
    const allSpreads = d.getSpreads()
    const targetSpreads = allSpreads.filter((s: any) => spreadIds.includes(s.id))

    const { breaksMap, summary } = batchDetectBreaks(targetSpreads)

    const newIssues = d.createIssuesFromBreaksMap(
      breaksMap,
      currentBook.value.id,
      author,
      currentBookSpreads.value
    )

    for (const [spreadId, breaks] of breaksMap) {
      const bsIdx = bookSpreads.value.findIndex((bs) => bs.spreadId === spreadId)
      if (bsIdx !== -1) {
        bookSpreads.value[bsIdx].breakCount = breaks.length
        bookSpreads.value[bsIdx].resolvedBreakCount = breaks.filter((b) => b.resolved).length
        bookSpreads.value[bsIdx].updatedAt = Date.now()
      }
    }

    d.addLog('批量检测问题', `整册「${currentBook.value.name}」${summary.message}，转化为 ${newIssues.length} 个工单`, null, null, null, author)
    return {
      success: true,
      message: `检测完成，生成 ${newIssues.length} 个问题工单`,
      totalIssues: newIssues.length
    }
  }

  function setBookBatchMode(enabled: boolean): void {
    isBookBatchMode.value = enabled
  }

  function generateBookReport(
    author: string = '整理员',
    deps?: Partial<BookDeps>
  ): BookClosureReport | null {
    const d = withDeps(deps)
    if (!currentBook.value) return null
    const report = generateBookClosureReport(
      currentBook.value,
      currentBookSpreads.value,
      currentBookIssues.value,
      author
    )
    d.addLog('生成闭环报告', `生成整册「${currentBook.value.name}」闭环报告`, null, null, null, author)
    return report
  }

  function exportBookReport(report: BookClosureReport, format: 'text' | 'json' = 'text'): string {
    if (format === 'json') {
      return JSON.stringify(report, null, 2)
    }
    return exportClosureReportAsText(report)
  }

  function clearBookData(): void {
    books.value = []
    currentBookId.value = null
    bookSpreads.value = []
    isBookBatchMode.value = false
    bookPageImages.value = []
  }

  return {
    books,
    currentBookId,
    bookSpreads,
    isBookBatchMode,
    bookPageImages,
    currentBook,
    currentBookSpreads,
    currentBookIssues,
    currentBookProgress,
    openIssuesCount,
    highPriorityIssuesCount,
    addBook,
    deleteBook,
    switchBook,
    updateBook,
    loadBookPageImages,
    generateBookSpreadsFromImages,
    batchAlignBookSpreads,
    batchDetectBookBreaks,
    setBookBatchMode,
    generateBookReport,
    exportBookReport,
    clearBookData
  }
})
