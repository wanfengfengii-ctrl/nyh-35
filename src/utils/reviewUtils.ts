import { v4 as uuidv4 } from 'uuid'
import {
  Region,
  SplitScheme,
  ReviewLogEntry,
  SchemeVersion,
  BatchReport,
  RegionStatus,
  RegionCategory,
  CandidateRegion,
  ReviewOpinion
} from '@/types'
import { calculateRegionArea } from './statistics'

export function createReviewLog(
  reviewer: string,
  action: string,
  schemeId: string,
  details: string,
  regionId: string | null = null,
  before: unknown | null = null,
  after: unknown | null = null
): ReviewLogEntry {
  return {
    id: uuidv4(),
    timestamp: Date.now(),
    reviewer,
    action,
    regionId,
    schemeId,
    details,
    before,
    after
  }
}

export function formatLogTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export function exportLogsAsText(logs: ReviewLogEntry[]): string {
  const lines: string[] = []
  lines.push('===== 复核操作日志 =====')
  lines.push(`导出时间: ${formatLogTimestamp(Date.now())}`)
  lines.push(`总记录数: ${logs.length}`)
  lines.push('')

  for (const log of logs) {
    lines.push(`[${formatLogTimestamp(log.timestamp)}] ${log.reviewer}`)
    lines.push(`  操作: ${log.action}`)
    lines.push(`  详情: ${log.details}`)
    if (log.regionId) lines.push(`  区域ID: ${log.regionId}`)
    lines.push('')
  }

  return lines.join('\n')
}

export function createSchemeVersion(
  scheme: SplitScheme,
  versionNumber: number,
  createdBy: string,
  description: string = '',
  reviewCount: number = 0
): SchemeVersion {
  return {
    id: uuidv4(),
    schemeId: scheme.id,
    versionNumber,
    name: `${scheme.name} v${versionNumber}`,
    snapshot: JSON.parse(JSON.stringify(scheme)),
    createdAt: Date.now(),
    createdBy,
    description,
    reviewCount
  }
}

export function findLatestVersion(versions: SchemeVersion[], schemeId: string): SchemeVersion | null {
  const schemeVersions = versions.filter(v => v.schemeId === schemeId)
  if (schemeVersions.length === 0) return null
  return schemeVersions.reduce((a, b) => (a.versionNumber > b.versionNumber ? a : b))
}

export function getNextVersionNumber(versions: SchemeVersion[], schemeId: string): number {
  const latest = findLatestVersion(versions, schemeId)
  return latest ? latest.versionNumber + 1 : 1
}

export function generateBatchReport(
  scheme: SplitScheme,
  candidates: CandidateRegion[],
  opinions: ReviewOpinion[]
): BatchReport {
  const regions = scheme.regions
  const regionsByStatus: Record<RegionStatus, number> = {
    [RegionStatus.PENDING]: 0,
    [RegionStatus.IN_PROGRESS]: 0,
    [RegionStatus.REVIEWED]: 0,
    [RegionStatus.FINALIZED]: 0
  }
  const regionsByCategory: Record<RegionCategory, number> = {
    [RegionCategory.MAIN_TEXT]: 0,
    [RegionCategory.HEAD_NOTE]: 0,
    [RegionCategory.INTERLINE_NOTE]: 0,
    [RegionCategory.IMAGE]: 0,
    [RegionCategory.TITLE_LABEL]: 0,
    [RegionCategory.DAMAGED]: 0
  }
  const areaByCategory: Record<RegionCategory, number> = {
    [RegionCategory.MAIN_TEXT]: 0,
    [RegionCategory.HEAD_NOTE]: 0,
    [RegionCategory.INTERLINE_NOTE]: 0,
    [RegionCategory.IMAGE]: 0,
    [RegionCategory.TITLE_LABEL]: 0,
    [RegionCategory.DAMAGED]: 0
  }

  let totalArea = 0
  for (const r of regions) {
    regionsByStatus[r.status]++
    regionsByCategory[r.category]++
    const area = calculateRegionArea(r)
    areaByCategory[r.category] += area
    totalArea += area
  }

  const autoAcceptedCount = candidates.filter(c => c.status === 'accepted').length
  const manualReviewedCount = regions.filter(r => r.status === RegionStatus.REVIEWED || r.status === RegionStatus.FINALIZED).length

  const reviewerContributions: Record<string, number> = {}
  for (const op of opinions) {
    reviewerContributions[op.reviewer] = (reviewerContributions[op.reviewer] || 0) + 1
  }

  const avgConfidence = candidates.length > 0
    ? candidates.reduce((sum, c) => sum + c.confidence, 0) / candidates.length
    : 0

  return {
    schemeId: scheme.id,
    schemeName: scheme.name,
    generatedAt: Date.now(),
    totalRegions: regions.length,
    regionsByStatus,
    regionsByCategory,
    autoAcceptedCount,
    manualReviewedCount,
    conflictCount: 0,
    resolvedConflictCount: 0,
    reviewerContributions,
    averageConfidence: Math.round(avgConfidence * 100) / 100,
    totalArea,
    areaByCategory
  }
}

export function exportReportAsCSV(report: BatchReport): string {
  const lines: string[] = []
  lines.push('指标,数值')
  lines.push(`方案名称,${report.schemeName}`)
  lines.push(`生成时间,${formatLogTimestamp(report.generatedAt)}`)
  lines.push(`区域总数,${report.totalRegions}`)
  lines.push(`自动采纳数,${report.autoAcceptedCount}`)
  lines.push(`人工复核数,${report.manualReviewedCount}`)
  lines.push(`平均置信度,${report.averageConfidence}%`)
  lines.push(`总面积(px²),${Math.round(report.totalArea)}`)
  lines.push('')
  lines.push('=== 按状态分布 ===')
  for (const [status, count] of Object.entries(report.regionsByStatus)) {
    lines.push(`${status},${count}`)
  }
  lines.push('')
  lines.push('=== 按类别分布 ===')
  for (const [category, count] of Object.entries(report.regionsByCategory)) {
    const area = report.areaByCategory[category as RegionCategory]
    lines.push(`${category},${count},${Math.round(area)}px²`)
  }
  lines.push('')
  lines.push('=== 复核人贡献 ===')
  for (const [reviewer, count] of Object.entries(report.reviewerContributions)) {
    lines.push(`${reviewer},${count}`)
  }
  return lines.join('\n')
}

export function exportReportAsJSON(report: BatchReport): string {
  return JSON.stringify(report, null, 2)
}

export function filterLogs(
  logs: ReviewLogEntry[],
  options: {
    reviewer?: string
    action?: string
    schemeId?: string
    regionId?: string
    startTime?: number
    endTime?: number
  }
): ReviewLogEntry[] {
  return logs.filter(log => {
    if (options.reviewer && log.reviewer !== options.reviewer) return false
    if (options.action && log.action !== options.action) return false
    if (options.schemeId && log.schemeId !== options.schemeId) return false
    if (options.regionId && log.regionId !== options.regionId) return false
    if (options.startTime && log.timestamp < options.startTime) return false
    if (options.endTime && log.timestamp > options.endTime) return false
    return true
  })
}
