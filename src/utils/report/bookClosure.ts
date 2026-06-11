import { v4 as uuidv4 } from 'uuid'
import {
  IssueStatus
} from '@/types'
import type {
  Book,
  BookSpread,
  Issue,
  BookClosureReport,
  BreakType,
  BreakSeverity,
  IssuePriority,
  ProofreadingStatus
} from '@/types'
import { formatTimestamp, formatDuration } from '../common/format'
import { BreakTypeLabel, BreakSeverityLabel, IssueStatusLabel } from '@/types'
import { calculateBookProgress } from '../book/progress'

export function generateBookClosureReport(
  book: Book,
  bookSpreads: BookSpread[],
  issues: Issue[],
  generatedBy: string
): BookClosureReport {
  const progress = calculateBookProgress(book, bookSpreads, issues)

  const issuesByType: Record<BreakType, number> = {
    text_break: 0,
    head_note_break: 0,
    interline_note_break: 0,
    image_break: 0,
    title_label_break: 0,
    column_misalignment: 0,
    seam_gap: 0
  }
  for (const issue of issues) {
    if (issue.breakType) {
      issuesByType[issue.breakType]++
    }
  }

  const issuesBySeverity: Record<BreakSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0
  }
  for (const issue of issues) {
    issuesBySeverity[issue.severity]++
  }

  const issuesByStatus: Record<IssueStatus, number> = {
    open: 0,
    assigned: 0,
    in_progress: 0,
    pending_review: 0,
    resolved: 0,
    closed: 0
  }
  for (const issue of issues) {
    issuesByStatus[issue.status]++
  }

  const issuesByPriority: Record<IssuePriority, number> = {
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0
  }
  for (const issue of issues) {
    issuesByPriority[issue.priority]++
  }

  const resolvedRate =
    issues.length > 0
      ? Math.round((progress.resolvedIssues / issues.length) * 100)
      : 100

  const assigneeStats: Record<string, { assigned: number; resolved: number }> = {}
  for (const issue of issues) {
    if (issue.assignee) {
      if (!assigneeStats[issue.assignee]) {
        assigneeStats[issue.assignee] = { assigned: 0, resolved: 0 }
      }
      assigneeStats[issue.assignee].assigned++
      if (
        issue.status === IssueStatus.RESOLVED ||
        issue.status === IssueStatus.CLOSED
      ) {
        assigneeStats[issue.assignee].resolved++
      }
    }
  }

  const resolvedIssues = issues.filter((i) => i.resolvedAt && i.createdAt)
  const averageResolutionTime =
    resolvedIssues.length > 0
      ? Math.round(
          resolvedIssues.reduce(
            (sum, i) => sum + ((i.resolvedAt || 0) - i.createdAt),
            0
          ) / resolvedIssues.length
        )
      : 0

  let progressSummary = ''
  if (progress.progressPercentage === 100) {
    progressSummary = `✅ 整册校对已全部完成，共 ${bookSpreads.length} 个跨页，${issues.length} 个问题已全部处理。`
  } else {
    progressSummary = `📊 整册校对进度：${progress.progressPercentage}%，已完成 ${progress.completedSpreads}/${progress.totalSpreads} 个跨页，待处理问题 ${progress.openIssues} 个。`
  }

  let qualityAssessment = ''
  if (resolvedRate >= 90 && progress.alignmentAverageConfidence >= 80) {
    qualityAssessment = '🌟 优秀：问题解决率高，对齐质量良好。'
  } else if (resolvedRate >= 70 && progress.alignmentAverageConfidence >= 60) {
    qualityAssessment = '👍 良好：大部分问题已解决，整体质量合格。'
  } else {
    qualityAssessment = '⚠️ 待改进：仍有较多问题需要处理，建议加强校对。'
  }

  const recommendations: string[] = []
  if (progress.highPriorityIssues > 0) {
    recommendations.push(`优先处理 ${progress.highPriorityIssues} 个高优先级问题`)
  }
  if (progress.overdueIssues > 0) {
    recommendations.push(`关注 ${progress.overdueIssues} 个已逾期问题`)
  }
  if (progress.alignmentAverageConfidence < 70) {
    recommendations.push('建议优化对齐参数，提高整体对齐置信度')
  }
  if (recommendations.length === 0) {
    recommendations.push('继续保持当前工作进度')
  }

  return {
    id: uuidv4(),
    bookId: book.id,
    bookName: book.name,
    generatedAt: Date.now(),
    generatedBy,
    totalPages: book.totalPages,
    totalSpreads: bookSpreads.length,
    totalIssues: issues.length,
    issuesByType,
    issuesBySeverity,
    issuesByStatus,
    issuesByPriority,
    resolvedRate,
    averageResolutionTime,
    assigneeStats,
    progressSummary,
    qualityAssessment,
    recommendations
  }
}

export function exportClosureReportAsText(report: BookClosureReport): string {
  const lines: string[] = []
  lines.push('============================================')
  lines.push('       古籍整册校对闭环报告')
  lines.push('============================================')
  lines.push('')
  lines.push(`报告编号: ${report.id}`)
  lines.push(`书籍名称: ${report.bookName}`)
  lines.push(`生成时间: ${formatTimestamp(report.generatedAt)}`)
  lines.push(`生成人员: ${report.generatedBy}`)
  lines.push(`总页数: ${report.totalPages} 页`)
  lines.push(`总跨页数: ${report.totalSpreads} 个`)
  lines.push('')
  lines.push('--------------------------------------------')
  lines.push('               进度概览')
  lines.push('--------------------------------------------')
  lines.push(report.progressSummary)
  lines.push('')
  lines.push(report.qualityAssessment)
  lines.push('')
  lines.push('--------------------------------------------')
  lines.push('             问题统计')
  lines.push('--------------------------------------------')
  lines.push(`问题总数: ${report.totalIssues}`)
  lines.push(`解决率: ${report.resolvedRate}%`)
  lines.push(`平均解决时长: ${formatDuration(report.averageResolutionTime)}`)
  lines.push('')
  lines.push('按类型分布:')
  for (const [type, count] of Object.entries(report.issuesByType)) {
    if (count > 0) {
      const typeLabel = BreakTypeLabel[type as BreakType]
      lines.push(`  ${typeLabel}: ${count} 个`)
    }
  }
  lines.push('')
  lines.push('按严重程度分布:')
  for (const [sev, count] of Object.entries(report.issuesBySeverity)) {
    const sevLabel = BreakSeverityLabel[sev as BreakSeverity]
    lines.push(`  ${sevLabel}: ${count} 个`)
  }
  lines.push('')
  lines.push('按状态分布:')
  for (const [status, count] of Object.entries(report.issuesByStatus)) {
    const statusLabel = IssueStatusLabel[status as IssueStatus]
    lines.push(`  ${statusLabel}: ${count} 个`)
  }
  lines.push('')
  lines.push('--------------------------------------------')
  lines.push('             人员贡献')
  lines.push('--------------------------------------------')
  for (const [name, stats] of Object.entries(report.assigneeStats)) {
    lines.push(`  ${name}: 分配 ${stats.assigned} 个，解决 ${stats.resolved} 个`)
  }
  lines.push('')
  lines.push('--------------------------------------------')
  lines.push('             改进建议')
  lines.push('--------------------------------------------')
  report.recommendations.forEach((rec, idx) => {
    lines.push(`  ${idx + 1}. ${rec}`)
  })
  lines.push('')
  lines.push('============================================')
  lines.push('                  报告结束')
  lines.push('============================================')
  return lines.join('\n')
}

export { ProofreadingStatus }
