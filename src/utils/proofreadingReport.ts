import { v4 as uuidv4 } from 'uuid'
import {
  SpreadView,
  SpreadPage,
  SpreadLayout,
  BreakRegion,
  BreakType,
  BreakSeverity,
  BreakTypeLabel,
  BreakSeverityLabel,
  SpreadConsistencyReport,
  SpreadConsistencyIssue,
  ProofreadingRecord,
  ProofreadingStatus,
  ProofreadingStatusLabel,
  RegionCategory
} from '@/types'
import { detectAllBreaks } from './breakDetection'

export function createProofreadingRecord(
  spreadId: string,
  operator: string
): ProofreadingRecord {
  return {
    id: uuidv4(),
    spreadId,
    operator,
    status: ProofreadingStatus.IN_PROGRESS,
    startTime: Date.now(),
    endTime: null,
    notes: '',
    reviewedBy: null,
    reviewedAt: null,
    reviewResult: ''
  }
}

export function updateProofreadingStatus(
  record: ProofreadingRecord,
  status: ProofreadingStatus,
  reviewer?: string
): ProofreadingRecord {
  const updates: Partial<ProofreadingRecord> = { status }
  if (status === ProofreadingStatus.IN_PROGRESS && !record.startTime) {
    updates.startTime = Date.now()
  }
  if (
    status === ProofreadingStatus.REVIEWED ||
    status === ProofreadingStatus.FINALIZED
  ) {
    updates.endTime = Date.now()
    if (reviewer) {
      updates.reviewedBy = reviewer
      updates.reviewedAt = Date.now()
    }
  }
  return { ...record, ...updates }
}

export function updateProofreadingNotes(
  record: ProofreadingRecord,
  notes: string
): ProofreadingRecord {
  return { ...record, notes }
}

export function buildIssueList(
  breaks: BreakRegion[],
  leftPageIndex: number = 0,
  rightPageIndex: number = 1
): SpreadConsistencyIssue[] {
  return breaks.map((b) => ({
    id: uuidv4(),
    breakId: b.id,
    breakType: b.breakType,
    severity: b.severity,
    description: b.description,
    suggestion: getSuggestionForBreak(b),
    leftPage: leftPageIndex,
    rightPage: rightPageIndex
  }))
}

function getSuggestionForBreak(breakRegion: BreakRegion): string {
  switch (breakRegion.breakType) {
    case BreakType.TEXT_BREAK:
      return '建议检查两页正文区域的边界是否连续，可微调页面偏移或扩展区域范围至页缝处'
    case BreakType.HEAD_NOTE_BREAK:
      return '眉批内容可能跨页延续，请核对眉批区域是否完整覆盖内容'
    case BreakType.INTERLINE_NOTE_BREAK:
      return '夹注可能被页缝截断，请检查夹注区域的左右边界'
    case BreakType.IMAGE_BREAK:
      return '图像区域疑似跨页，建议确认图像是否完整或需要拼接修复'
    case BreakType.TITLE_LABEL_BREAK:
      return '题签区域可能跨越页缝，请检查题签位置和完整性'
    case BreakType.COLUMN_MISALIGNMENT:
      return '栏线上下错位，建议调整页面垂直对齐参数或修正正文栏区域'
    case BreakType.SEAM_GAP:
      return '页缝间距异常，建议调整页面间距参数至合理范围（约20px）'
    default:
      return '请人工核实该区域是否存在跨页问题'
  }
}

export function countIssuesByType(
  issues: SpreadConsistencyIssue[]
): Record<BreakType, number> {
  const result: Record<BreakType, number> = {
    [BreakType.TEXT_BREAK]: 0,
    [BreakType.HEAD_NOTE_BREAK]: 0,
    [BreakType.INTERLINE_NOTE_BREAK]: 0,
    [BreakType.IMAGE_BREAK]: 0,
    [BreakType.TITLE_LABEL_BREAK]: 0,
    [BreakType.COLUMN_MISALIGNMENT]: 0,
    [BreakType.SEAM_GAP]: 0
  }
  for (const issue of issues) {
    result[issue.breakType]++
  }
  return result
}

export function countIssuesBySeverity(
  issues: SpreadConsistencyIssue[]
): Record<BreakSeverity, number> {
  const result: Record<BreakSeverity, number> = {
    [BreakSeverity.LOW]: 0,
    [BreakSeverity.MEDIUM]: 0,
    [BreakSeverity.HIGH]: 0
  }
  for (const issue of issues) {
    result[issue.severity]++
  }
  return result
}

export function generateSpreadConsistencyReport(
  spread: SpreadView,
  breaks: BreakRegion[],
  proofreadingRecord: ProofreadingRecord | null,
  generatedBy: string,
  alignmentConfidence: number = 0
): SpreadConsistencyReport {
  let leftPageIndex = 0
  let rightPageIndex = 1
  if (spread.pages.length >= 2) {
    if (spread.layout === SpreadLayout.LEFT_RIGHT) {
      leftPageIndex = spread.pages[0].pageIndex
      rightPageIndex = spread.pages[1].pageIndex
    } else {
      leftPageIndex = spread.pages[1].pageIndex
      rightPageIndex = spread.pages[0].pageIndex
    }
  }

  const issues = buildIssueList(breaks, leftPageIndex, rightPageIndex)
  const resolvedCount = breaks.filter((b) => b.resolved).length
  const unresolvedCount = breaks.length - resolvedCount
  const issuesByType = countIssuesByType(issues)
  const issuesBySeverity = countIssuesBySeverity(issues)

  const highCount = issuesBySeverity[BreakSeverity.HIGH]
  const mediumCount = issuesBySeverity[BreakSeverity.MEDIUM]

  let summary = ''
  if (breaks.length === 0) {
    summary = '✅ 未检测到跨页断裂或错位问题，跨页一致性良好。'
  } else {
    summary = `⚠️ 共检测到 ${breaks.length} 个潜在问题：严重 ${highCount} 个，中等 ${mediumCount} 个，轻微 ${issuesBySeverity[BreakSeverity.LOW]} 个。已解决 ${resolvedCount} 个，待处理 ${unresolvedCount} 个。`
    if (highCount > 0) {
      summary += ' 建议优先处理严重问题。'
    }
  }

  return {
    id: uuidv4(),
    spreadId: spread.id,
    spreadName: spread.name,
    generatedAt: Date.now(),
    generatedBy,
    totalIssues: issues.length,
    issuesByType,
    issuesBySeverity,
    resolvedCount,
    unresolvedCount,
    alignmentConfidence,
    proofreadingStatus: proofreadingRecord?.status || ProofreadingStatus.NOT_STARTED,
    issues,
    summary
  }
}

export function exportReportAsText(report: SpreadConsistencyReport): string {
  const lines: string[] = []
  lines.push('============================================')
  lines.push('       古籍跨页一致性校对报告')
  lines.push('============================================')
  lines.push('')
  lines.push(`报告编号: ${report.id}`)
  lines.push(`跨页名称: ${report.spreadName}`)
  lines.push(`生成时间: ${formatTimestamp(report.generatedAt)}`)
  lines.push(`生成人员: ${report.generatedBy}`)
  lines.push(`校对状态: ${ProofreadingStatusLabel[report.proofreadingStatus]}`)
  lines.push(`对齐置信度: ${report.alignmentConfidence}%`)
  lines.push('')
  lines.push('--------------------------------------------')
  lines.push('               总体概览')
  lines.push('--------------------------------------------')
  lines.push(report.summary)
  lines.push('')
  lines.push(`问题总数: ${report.totalIssues}`)
  lines.push(`已解决: ${report.resolvedCount}`)
  lines.push(`待处理: ${report.unresolvedCount}`)
  lines.push('')
  lines.push('--------------------------------------------')
  lines.push('             问题类型分布')
  lines.push('--------------------------------------------')
  for (const [type, count] of Object.entries(report.issuesByType)) {
    if (count > 0) {
      lines.push(`  ${BreakTypeLabel[type as BreakType]}: ${count} 个`)
    }
  }
  lines.push('')
  lines.push('--------------------------------------------')
  lines.push('             严重程度分布')
  lines.push('--------------------------------------------')
  for (const [severity, count] of Object.entries(report.issuesBySeverity)) {
    lines.push(`  ${BreakSeverityLabel[severity as BreakSeverity]}: ${count} 个`)
  }
  lines.push('')
  lines.push('--------------------------------------------')
  lines.push('             问题清单')
  lines.push('--------------------------------------------')
  if (report.issues.length === 0) {
    lines.push('  无待处理问题。')
  } else {
    report.issues.forEach((issue, index) => {
      lines.push('')
      lines.push(`问题 ${index + 1} [${BreakSeverityLabel[issue.severity]}] - ${BreakTypeLabel[issue.breakType]}`)
      lines.push(`  描述: ${issue.description}`)
      lines.push(`  建议: ${issue.suggestion}`)
    })
  }
  lines.push('')
  lines.push('============================================')
  lines.push('                  报告结束')
  lines.push('============================================')
  return lines.join('\n')
}

export function exportReportAsCSV(report: SpreadConsistencyReport): string {
  const lines: string[] = []
  lines.push('序号,问题类型,严重程度,描述,建议,左页,右页')
  report.issues.forEach((issue, index) => {
    lines.push(
      [
        index + 1,
        BreakTypeLabel[issue.breakType],
        BreakSeverityLabel[issue.severity],
        `"${issue.description.replace(/"/g, '""')}"`,
        `"${issue.suggestion.replace(/"/g, '""')}"`,
        issue.leftPage,
        issue.rightPage
      ].join(',')
    )
  })
  lines.push('')
  lines.push('统计项,数值')
  lines.push(`问题总数,${report.totalIssues}`)
  lines.push(`已解决,${report.resolvedCount}`)
  lines.push(`待处理,${report.unresolvedCount}`)
  lines.push(`对齐置信度,${report.alignmentConfidence}%`)
  for (const [type, count] of Object.entries(report.issuesByType)) {
    if (count > 0) {
      lines.push(`${BreakTypeLabel[type as BreakType]},${count}`)
    }
  }
  for (const [severity, count] of Object.entries(report.issuesBySeverity)) {
    lines.push(`${BreakSeverityLabel[severity as BreakSeverity]},${count}`)
  }
  return lines.join('\n')
}

export function exportReportAsJSON(report: SpreadConsistencyReport): string {
  return JSON.stringify(report, null, 2)
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export function getRegionCategoryFromBreakType(breakType: BreakType): RegionCategory | null {
  const map: Partial<Record<BreakType, RegionCategory>> = {
    [BreakType.TEXT_BREAK]: RegionCategory.MAIN_TEXT,
    [BreakType.HEAD_NOTE_BREAK]: RegionCategory.HEAD_NOTE,
    [BreakType.INTERLINE_NOTE_BREAK]: RegionCategory.INTERLINE_NOTE,
    [BreakType.IMAGE_BREAK]: RegionCategory.IMAGE,
    [BreakType.TITLE_LABEL_BREAK]: RegionCategory.TITLE_LABEL
  }
  return map[breakType] || null
}
