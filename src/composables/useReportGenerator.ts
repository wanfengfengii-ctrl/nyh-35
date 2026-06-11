import { ref } from 'vue'
import { useNotify } from '@/utils/common/notification'
import { useImportExport } from './useImportExport'
import type {
  BatchReport,
  BookClosureReport,
  SpreadConsistencyReport
} from '@/types'
import { useReviewStore } from '@/stores/review'
import { useSpreadStore } from '@/stores/spread'
import { useBookStore } from '@/stores/book'
import { useAppStore } from '@/stores/app'
import type { AlignmentMethod } from '@/types'

export function useReportGenerator() {
  const notify = useNotify()
  const impExp = useImportExport()
  const reviewStore = useReviewStore()
  const spreadStore = useSpreadStore()
  const bookStore = useBookStore()
  const appStore = useAppStore()

  const isGenerating = ref(false)

  function generateSchemeReport(): BatchReport | null {
    const report = reviewStore.generateReport()
    if (!report) {
      notify.warning('当前没有可生成报表的方案')
      return null
    }
    notify.success('方案报表已生成')
    return report
  }

  function exportSchemeReportJSON(report: BatchReport): void {
    const name = `方案报表_${report.schemeName}_${Date.now()}.json`
    impExp.exportJSON(report, name)
  }

  function generateSpreadReport(spreadId: string): SpreadConsistencyReport | null {
    const report = spreadStore.generateSpreadReport(
      spreadId,
      appStore.currentAuthor
    )
    if (!report) {
      notify.warning('没有可生成报表的跨页')
      return null
    }
    notify.success('跨页一致性报告已生成')
    return report
  }

  function exportSpreadReportJSON(report: SpreadConsistencyReport): void {
    const name = `跨页报告_${report.spreadName}_${Date.now()}.json`
    impExp.exportJSON(report, name)
  }

  function generateBookReport(): BookClosureReport | null {
    const report = bookStore.generateBookReport(appStore.currentAuthor)
    if (!report) {
      notify.warning('当前没有可生成报告的整册项目')
      return null
    }
    return report
  }

  function exportBookReport(
    report: BookClosureReport,
    format: 'text' | 'json' = 'text'
  ): void {
    if (format === 'json') {
      const name = `整册闭环报告_${report.bookName}_${Date.now()}.json`
      impExp.exportJSON(report, name)
    } else {
      const text = bookStore.exportBookReport(report, 'text')
      const name = `整册闭环报告_${report.bookName}_${Date.now()}.txt`
      impExp.exportText(text, name)
    }
  }

  function runBookBatchAlign(method: AlignmentMethod): {
    success: boolean
    message: string
    processed: number
    failed: number
  } {
    isGenerating.value = true
    try {
      const result = bookStore.batchAlignBookSpreads(
        method,
        appStore.currentAuthor
      )
      if (result.success) {
        notify.success(result.message)
      } else {
        notify.warning(result.message)
      }
      return result
    } finally {
      isGenerating.value = false
    }
  }

  function runBookBatchDetectBreaks(): {
    success: boolean
    message: string
    totalIssues: number
  } {
    isGenerating.value = true
    try {
      const result = bookStore.batchDetectBookBreaks(appStore.currentAuthor)
      if (result.success) {
        notify.success(result.message)
      } else {
        notify.warning(result.message)
      }
      return result
    } finally {
      isGenerating.value = false
    }
  }

  return {
    isGenerating,
    generateSchemeReport,
    exportSchemeReportJSON,
    generateSpreadReport,
    exportSpreadReportJSON,
    generateBookReport,
    exportBookReport,
    runBookBatchAlign,
    runBookBatchDetectBreaks
  }
}
