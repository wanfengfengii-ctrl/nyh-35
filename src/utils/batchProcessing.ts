import { v4 as uuidv4 } from 'uuid'
import {
  Book,
  BookSpread,
  BookStatus,
  SpreadView,
  SpreadLayout,
  PageImage,
  SplitScheme,
  SpreadPage,
  AlignmentMethod,
  BreakRegion,
  Issue,
  IssueStatus,
  IssuePriority,
  BreakSeverity,
  BreakType,
  ProofreadingStatus,
  BookProgress,
  BatchProcessingResult,
  BookClosureReport,
  ReviewResult,
  IssueFilter
} from '@/types'
import { createSpreadView, addPageToSpread, autoAlignSpread } from './spreadAlignment'
import { detectAllBreaks } from './breakDetection'
import { cloneSplitScheme } from './validators'

export function createBook(
  name: string,
  author: string,
  totalPages: number,
  startPage: number = 1,
  endPage?: number,
  layout: SpreadLayout = SpreadLayout.RIGHT_LEFT,
  description: string = ''
): Book {
  return {
    id: uuidv4(),
    name,
    author,
    description,
    totalPages,
    status: BookStatus.NOT_STARTED,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    startPage,
    endPage: endPage || totalPages,
    layout,
    pageGap: 20
  }
}

export function generateBookSpreads(
  book: Book,
  pageImages: PageImage[],
  schemes: Map<string, SplitScheme> = new Map()
): { spreads: SpreadView[]; bookSpreads: BookSpread[] } {
  const spreadViews: SpreadView[] = []
  const bookSpreads: BookSpread[] = []
  const actualEnd = Math.min(book.endPage, book.totalPages)
  const spreadCount = Math.ceil((actualEnd - book.startPage + 1) / 2)

  for (let i = 0; i < spreadCount; i++) {
    const leftPageIdx = book.startPage + i * 2 - 1
    const rightPageIdx = leftPageIdx + 1

    const spreadName = `第${leftPageIdx}-${rightPageIdx}页跨页`
    const spread = createSpreadView(spreadName, book.layout, book.pageGap)

    const leftImage = pageImages[leftPageIdx] || pageImages[i * 2]
    const rightImage = pageImages[rightPageIdx] || pageImages[i * 2 + 1]

    if (leftImage) {
      const leftScheme = schemes.get(leftImage.id) || null
      addPageToSpread(spread, leftImage, leftScheme)
    }
    if (rightImage) {
      const rightScheme = schemes.get(rightImage.id) || null
      addPageToSpread(spread, rightImage, rightScheme)
    }

    spreadViews.push(spread)

    const bookSpread: BookSpread = {
      id: uuidv4(),
      bookId: book.id,
      spreadId: spread.id,
      leftPageIndex: i * 2,
      rightPageIndex: i * 2 + 1,
      sequence: i + 1,
      alignmentConfidence: 0,
      breakCount: 0,
      resolvedBreakCount: 0,
      proofreadingStatus: ProofreadingStatus.NOT_STARTED,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    bookSpreads.push(bookSpread)
  }

  return { spreads: spreadViews, bookSpreads }
}

export function inheritAdjacentScheme(
  targetScheme: SplitScheme,
  sourceScheme: SplitScheme,
  direction: 'left' | 'right' = 'right'
): SplitScheme {
  const cloned = cloneSplitScheme(targetScheme)
  cloned.id = uuidv4()
  cloned.updatedAt = Date.now()
  cloned.regions = cloned.regions.map((r) => ({ ...r, id: uuidv4() }))

  const sourceMainRegions = sourceScheme.regions.filter(
    (r) => !r.hidden && r.position
  )

  if (sourceMainRegions.length === 0) return cloned

  const avgY =
    sourceMainRegions.reduce((sum, r) => sum + r.position.y, 0) /
    sourceMainRegions.length
  const avgHeight =
    sourceMainRegions.reduce((sum, r) => sum + r.position.height, 0) /
    sourceMainRegions.length

  cloned.regions = cloned.regions.map((r) => ({
    ...r,
    position: {
      ...r.position,
      y: Math.round(avgY - avgHeight / 2 + r.position.height / 2)
    }
  }))

  return cloned
}

export function batchAlignSpreads(
  spreads: SpreadView[],
  method: AlignmentMethod = AlignmentMethod.BLOCK_CENTER
): { results: (AlignmentResult & { updatedSpread: SpreadView })[]; summary: BatchProcessingResult } {
  const results: (AlignmentResult & { updatedSpread: SpreadView })[] = []
  let successCount = 0
  const details: string[] = []

  for (const spread of spreads) {
    if (spread.pages.length < 2) {
      details.push(`跳过「${spread.name}」：页面不足`)
      continue
    }
    const result = autoAlignSpread(spread, method)
    results.push(result)
    if (result.success) {
      successCount++
      details.push(`「${spread.name}」对齐成功，置信度${result.confidence}%`)
    } else {
      details.push(`「${spread.name}」对齐失败：${result.details}`)
    }
  }

  const summary: BatchProcessingResult = {
    success: successCount > 0,
    total: spreads.length,
    processed: results.length,
    failed: spreads.length - successCount,
    message: `批量对齐完成：成功 ${successCount} 个，失败 ${spreads.length - successCount} 个`,
    details
  }

  return { results, summary }
}

export function batchDetectBreaks(
  spreads: SpreadView[]
): { breaksMap: Map<string, BreakRegion[]>; summary: BatchProcessingResult } {
  const breaksMap = new Map<string, BreakRegion[]>()
  let totalBreaks = 0
  const details: string[] = []

  for (const spread of spreads) {
    if (spread.pages.length < 2) {
      details.push(`跳过「${spread.name}」：页面不足`)
      continue
    }
    const breaks = detectAllBreaks(spread)
    breaksMap.set(spread.id, breaks)
    totalBreaks += breaks.length
    details.push(`「${spread.name}」检测到 ${breaks.length} 个问题`)
  }

  const summary: BatchProcessingResult = {
    success: true,
    total: spreads.length,
    processed: spreads.length,
    failed: 0,
    message: `批量检测完成：共发现 ${totalBreaks} 个问题`,
    details
  }

  return { breaksMap, summary }
}

export function createIssueFromBreak(
  breakRegion: BreakRegion,
  bookId: string,
  spreadId: string,
  reporter: string,
  leftPageIndex?: number,
  rightPageIndex?: number
): Issue {
  const priorityMap: Record<BreakSeverity, IssuePriority> = {
    [BreakSeverity.LOW]: IssuePriority.LOW,
    [BreakSeverity.MEDIUM]: IssuePriority.MEDIUM,
    [BreakSeverity.HIGH]: IssuePriority.HIGH
  }

  return {
    id: uuidv4(),
    bookId,
    spreadId,
    breakId: breakRegion.id,
    breakType: breakRegion.breakType,
    title: breakRegion.description.substring(0, 50) + (breakRegion.description.length > 50 ? '...' : ''),
    description: breakRegion.description,
    status: IssueStatus.OPEN,
    priority: priorityMap[breakRegion.severity],
    severity: breakRegion.severity,
    assignee: null,
    reporter,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    dueDate: null,
    resolvedAt: null,
    closedAt: null,
    reviewResult: null,
    reviewComment: '',
    reviewer: null,
    reviewedAt: null,
    comments: [],
    tags: [],
    leftPageIndex: leftPageIndex ?? null,
    rightPageIndex: rightPageIndex ?? null
  }
}

export function createIssuesFromBreaks(
  breaksMap: Map<string, BreakRegion[]>,
  bookId: string,
  reporter: string,
  bookSpreads: BookSpread[] = []
): Issue[] {
  const issues: Issue[] = []

  for (const [spreadId, breaks] of breaksMap) {
    const bookSpread = bookSpreads.find((bs) => bs.spreadId === spreadId)
    for (const br of breaks) {
      const issue = createIssueFromBreak(
        br,
        bookId,
        spreadId,
        reporter,
        bookSpread?.leftPageIndex,
        bookSpread?.rightPageIndex
      )
      issues.push(issue)
    }
  }

  return issues
}

export function assignIssue(
  issue: Issue,
  assignee: string,
  dueDate?: number
): Issue {
  return {
    ...issue,
    assignee,
    status: IssueStatus.ASSIGNED,
    dueDate: dueDate || issue.dueDate,
    updatedAt: Date.now()
  }
}

export function updateIssueStatus(
  issue: Issue,
  status: IssueStatus,
  operator: string
): Issue {
  const now = Date.now()
  const updates: Partial<Issue> = {
    status,
    updatedAt: now
  }

  if (status === IssueStatus.IN_PROGRESS && issue.status === IssueStatus.ASSIGNED) {
  }
  if (status === IssueStatus.RESOLVED) {
    updates.resolvedAt = now
  }
  if (status === IssueStatus.CLOSED) {
    updates.closedAt = now
  }

  return { ...issue, ...updates }
}

export function reviewIssue(
  issue: Issue,
  reviewer: string,
  result: ReviewResult,
  comment: string = ''
): Issue {
  const now = Date.now()
  let newStatus = issue.status

  if (result === ReviewResult.APPROVED) {
    newStatus = IssueStatus.CLOSED
  } else if (result === ReviewResult.REJECTED) {
    newStatus = IssueStatus.IN_PROGRESS
  } else if (result === ReviewResult.NEEDS_REVISION) {
    newStatus = IssueStatus.IN_PROGRESS
  }

  return {
    ...issue,
    reviewResult: result,
    reviewComment: comment,
    reviewer,
    reviewedAt: now,
    status: newStatus,
    updatedAt: now,
    closedAt: result === ReviewResult.APPROVED ? now : issue.closedAt
  }
}

export function calculateBookProgress(
  book: Book,
  bookSpreads: BookSpread[],
  issues: Issue[]
): BookProgress {
  const totalSpreads = bookSpreads.length
  const completedSpreads = bookSpreads.filter(
    (s) => s.proofreadingStatus === ProofreadingStatus.FINALIZED
  ).length
  const inProgressSpreads = bookSpreads.filter(
    (s) => s.proofreadingStatus === ProofreadingStatus.IN_PROGRESS
  ).length
  const pendingSpreads = bookSpreads.filter(
    (s) =>
      s.proofreadingStatus === ProofreadingStatus.NOT_STARTED ||
      s.proofreadingStatus === ProofreadingStatus.REVIEWED
  ).length

  const totalIssues = issues.length
  const openIssues = issues.filter((i) => i.status === IssueStatus.OPEN).length
  const resolvedIssues = issues.filter(
    (i) => i.status === IssueStatus.RESOLVED || i.status === IssueStatus.CLOSED
  ).length
  const closedIssues = issues.filter((i) => i.status === IssueStatus.CLOSED).length
  const highPriorityIssues = issues.filter(
    (i) => i.priority === IssuePriority.HIGH || i.priority === IssuePriority.URGENT
  ).length
  const overdueIssues = issues.filter(
    (i) =>
      i.dueDate &&
      i.dueDate < Date.now() &&
      i.status !== IssueStatus.CLOSED &&
      i.status !== IssueStatus.RESOLVED
  ).length

  const confidences = bookSpreads
    .filter((s) => s.alignmentConfidence > 0)
    .map((s) => s.alignmentConfidence)
  const alignmentAverageConfidence =
    confidences.length > 0
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : 0

  const progressPercentage =
    totalSpreads > 0 ? Math.round((completedSpreads / totalSpreads) * 100) : 0

  return {
    bookId: book.id,
    totalSpreads,
    completedSpreads,
    inProgressSpreads,
    pendingSpreads,
    totalIssues,
    openIssues,
    resolvedIssues,
    closedIssues,
    highPriorityIssues,
    overdueIssues,
    alignmentAverageConfidence,
    progressPercentage,
    estimatedCompletionDate: null
  }
}

export function filterIssues(
  issues: Issue[],
  filter: IssueFilter
): Issue[] {
  return issues.filter((issue) => {
    if (filter.status && filter.status.length > 0) {
      if (!filter.status.includes(issue.status)) return false
    }
    if (filter.priority && filter.priority.length > 0) {
      if (!filter.priority.includes(issue.priority)) return false
    }
    if (filter.severity && filter.severity.length > 0) {
      if (!filter.severity.includes(issue.severity)) return false
    }
    if (filter.assignee !== undefined) {
      if (issue.assignee !== filter.assignee) return false
    }
    if (filter.breakType && filter.breakType.length > 0) {
      if (!issue.breakType || !filter.breakType.includes(issue.breakType)) return false
    }
    if (filter.keyword) {
      const keyword = filter.keyword.toLowerCase()
      if (
        !issue.title.toLowerCase().includes(keyword) &&
        !issue.description.toLowerCase().includes(keyword)
      ) {
        return false
      }
    }
    if (filter.dueDateFrom && issue.dueDate) {
      if (issue.dueDate < filter.dueDateFrom) return false
    }
    if (filter.dueDateTo && issue.dueDate) {
      if (issue.dueDate > filter.dueDateTo) return false
    }
    return true
  })
}

export function generateBookClosureReport(
  book: Book,
  bookSpreads: BookSpread[],
  issues: Issue[],
  generatedBy: string
): BookClosureReport {
  const progress = calculateBookProgress(book, bookSpreads, issues)

  const issuesByType: Record<BreakType, number> = {
    [BreakType.TEXT_BREAK]: 0,
    [BreakType.HEAD_NOTE_BREAK]: 0,
    [BreakType.INTERLINE_NOTE_BREAK]: 0,
    [BreakType.IMAGE_BREAK]: 0,
    [BreakType.TITLE_LABEL_BREAK]: 0,
    [BreakType.COLUMN_MISALIGNMENT]: 0,
    [BreakType.SEAM_GAP]: 0
  }
  for (const issue of issues) {
    if (issue.breakType) {
      issuesByType[issue.breakType]++
    }
  }

  const issuesBySeverity: Record<BreakSeverity, number> = {
    [BreakSeverity.LOW]: 0,
    [BreakSeverity.MEDIUM]: 0,
    [BreakSeverity.HIGH]: 0
  }
  for (const issue of issues) {
    issuesBySeverity[issue.severity]++
  }

  const issuesByStatus: Record<IssueStatus, number> = {
    [IssueStatus.OPEN]: 0,
    [IssueStatus.ASSIGNED]: 0,
    [IssueStatus.IN_PROGRESS]: 0,
    [IssueStatus.PENDING_REVIEW]: 0,
    [IssueStatus.RESOLVED]: 0,
    [IssueStatus.CLOSED]: 0
  }
  for (const issue of issues) {
    issuesByStatus[issue.status]++
  }

  const issuesByPriority: Record<IssuePriority, number> = {
    [IssuePriority.LOW]: 0,
    [IssuePriority.MEDIUM]: 0,
    [IssuePriority.HIGH]: 0,
    [IssuePriority.URGENT]: 0
  }
  for (const issue of issues) {
    issuesByPriority[issue.priority]++
  }

  const resolvedRate =
    issues.length > 0 ? Math.round((progress.resolvedIssues / issues.length) * 100) : 100

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

  const resolvedIssues = issues.filter(
    (i) => i.resolvedAt && i.createdAt
  )
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
      const typeLabel = getBreakTypeLabel(type as BreakType)
      lines.push(`  ${typeLabel}: ${count} 个`)
    }
  }
  lines.push('')
  lines.push('按严重程度分布:')
  for (const [sev, count] of Object.entries(report.issuesBySeverity)) {
    const sevLabel = getSeverityLabel(sev as BreakSeverity)
    lines.push(`  ${sevLabel}: ${count} 个`)
  }
  lines.push('')
  lines.push('按状态分布:')
  for (const [status, count] of Object.entries(report.issuesByStatus)) {
    const statusLabel = getIssueStatusLabel(status as IssueStatus)
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

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0 分钟'
  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days} 天 ${hours % 24} 小时`
  if (hours > 0) return `${hours} 小时 ${minutes % 60} 分钟`
  return `${minutes} 分钟`
}

function getBreakTypeLabel(type: BreakType): string {
  const labels: Record<BreakType, string> = {
    [BreakType.TEXT_BREAK]: '正文断裂',
    [BreakType.HEAD_NOTE_BREAK]: '眉批断裂',
    [BreakType.INTERLINE_NOTE_BREAK]: '夹注断裂',
    [BreakType.IMAGE_BREAK]: '图像断裂',
    [BreakType.TITLE_LABEL_BREAK]: '题签断裂',
    [BreakType.COLUMN_MISALIGNMENT]: '栏线错位',
    [BreakType.SEAM_GAP]: '页缝异常'
  }
  return labels[type] || type
}

function getSeverityLabel(sev: BreakSeverity): string {
  const labels: Record<BreakSeverity, string> = {
    [BreakSeverity.LOW]: '轻微',
    [BreakSeverity.MEDIUM]: '中等',
    [BreakSeverity.HIGH]: '严重'
  }
  return labels[sev] || sev
}

function getIssueStatusLabel(status: IssueStatus): string {
  const labels: Record<IssueStatus, string> = {
    [IssueStatus.OPEN]: '待分配',
    [IssueStatus.ASSIGNED]: '已分配',
    [IssueStatus.IN_PROGRESS]: '处理中',
    [IssueStatus.PENDING_REVIEW]: '待复核',
    [IssueStatus.RESOLVED]: '已解决',
    [IssueStatus.CLOSED]: '已关闭'
  }
  return labels[status] || status
}
