import { v4 as uuidv4 } from 'uuid'
import {
  Region,
  RegionCategory,
  RegionPosition,
  RegionTemplate,
  CandidateRegion,
  CandidateStatus,
  ConflictInfo,
  ReviewOpinion,
  ReviewDecision,
  RegionStatus,
  RegionDiff,
  SplitScheme
} from '@/types'

export function calculateIoU(a: RegionPosition, b: RegionPosition): number {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.width, b.x + b.width)
  const y2 = Math.min(a.y + a.height, b.y + b.height)
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const areaA = a.width * a.height
  const areaB = b.width * b.height
  const union = areaA + areaB - intersection
  return union > 0 ? intersection / union : 0
}

export function calculatePositionSimilarity(
  template: RegionTemplate,
  pageWidth: number,
  pageHeight: number
): number {
  const scaleX = pageWidth / template.pageWidth
  const scaleY = pageHeight / template.pageHeight
  const avgScale = (scaleX + scaleY) / 2
  const sizeDeviation = Math.abs(1 - avgScale)
  return Math.max(0, 1 - sizeDeviation * 0.5)
}

export function scaleTemplatePosition(
  template: RegionTemplate,
  targetPageWidth: number,
  targetPageHeight: number
): RegionPosition {
  const scaleX = targetPageWidth / template.pageWidth
  const scaleY = targetPageHeight / template.pageHeight
  return {
    x: template.position.x * scaleX,
    y: template.position.y * scaleY,
    width: template.position.width * scaleX,
    height: template.position.height * scaleY
  }
}

export function generateCandidates(
  templates: RegionTemplate[],
  pageWidth: number,
  pageHeight: number,
  existingRegions: Region[]
): CandidateRegion[] {
  const candidates: CandidateRegion[] = []

  for (const template of templates) {
    const scaledPosition = scaleTemplatePosition(template, pageWidth, pageHeight)
    const posSimilarity = calculatePositionSimilarity(template, pageWidth, pageHeight)

    let matchedRegionId: string | null = null
    let maxIoU = 0
    for (const region of existingRegions) {
      const iou = calculateIoU(scaledPosition, region.position)
      if (iou > maxIoU) {
        maxIoU = iou
        if (iou > 0.5) {
          matchedRegionId = region.id
        }
      }
    }

    const usageFactor = Math.min(1, template.usageCount / 10)
    const confidence = Math.round((posSimilarity * 0.5 + usageFactor * 0.3 + (1 - maxIoU) * 0.2) * 100)

    let suggestion = ''
    if (maxIoU > 0.7) {
      suggestion = `与现有区域高度重叠（重叠度 ${(maxIoU * 100).toFixed(1)}%），建议修改边界`
    } else if (maxIoU > 0.3) {
      suggestion = `与现有区域部分重叠（重叠度 ${(maxIoU * 100).toFixed(1)}%），请确认`
    } else {
      suggestion = '建议采纳此候选区域'
    }

    candidates.push({
      id: uuidv4(),
      templateId: template.id,
      templateName: template.name,
      category: template.category,
      position: scaledPosition,
      confidence: Math.max(20, Math.min(99, confidence)),
      status: CandidateStatus.PENDING,
      matchedRegionId,
      suggestion
    })
  }

  candidates.sort((a, b) => b.confidence - a.confidence)
  return candidates
}

export function createRegionFromCandidate(candidate: CandidateRegion): Region {
  return {
    id: uuidv4(),
    name: `候选_${candidate.templateName}`,
    category: candidate.category,
    order: 0,
    description: `基于模板「${candidate.templateName}」自动生成，置信度 ${candidate.confidence}%`,
    status: RegionStatus.IN_PROGRESS,
    hidden: false,
    position: { ...candidate.position }
  }
}

export function detectConflicts(regions: Region[]): ConflictInfo[] {
  const conflicts: ConflictInfo[] = []
  const seen = new Set<string>()

  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      const a = regions[i]
      const b = regions[j]
      const iou = calculateIoU(a.position, b.position)

      if (iou > 0.1) {
        const key = [a.id, b.id].sort().join('|')
        if (seen.has(key)) continue
        seen.add(key)

        let severity: 'low' | 'medium' | 'high' = 'low'
        if (iou > 0.5) severity = 'high'
        else if (iou > 0.25) severity = 'medium'

        conflicts.push({
          id: uuidv4(),
          type: 'overlap',
          regionIds: [a.id, b.id],
          severity,
          description: `「${a.name}」与「${b.name}」重叠度 ${(iou * 100).toFixed(1)}%`,
          resolved: false
        })
      }
    }
  }

  const orderMap = new Map<number, Region[]>()
  for (const r of regions) {
    if (!orderMap.has(r.order)) orderMap.set(r.order, [])
    orderMap.get(r.order)!.push(r)
  }
  for (const [order, dupRegions] of orderMap) {
    if (dupRegions.length > 1) {
      conflicts.push({
        id: uuidv4(),
        type: 'order_conflict',
        regionIds: dupRegions.map(r => r.id),
        severity: 'medium',
        description: `顺序 ${order} 被 ${dupRegions.length} 个区域同时占用：${dupRegions.map(r => r.name).join('、')}`,
        resolved: false
      })
    }
  }

  return conflicts
}

export function mergeReviewOpinions(opinions: ReviewOpinion[]): ReviewDecision {
  if (opinions.length === 0) return ReviewDecision.PENDING
  const counts: Record<ReviewDecision, number> = {
    [ReviewDecision.APPROVE]: 0,
    [ReviewDecision.REJECT]: 0,
    [ReviewDecision.MODIFY]: 0,
    [ReviewDecision.PENDING]: 0
  }
  for (const op of opinions) counts[op.decision]++
  if (counts[ReviewDecision.APPROVE] > opinions.length / 2) return ReviewDecision.APPROVE
  if (counts[ReviewDecision.REJECT] > opinions.length / 2) return ReviewDecision.REJECT
  if (counts[ReviewDecision.MODIFY] > 0) return ReviewDecision.MODIFY
  return ReviewDecision.PENDING
}

export function calculateRegionDiff(before: Region, after: Region): RegionDiff[] {
  const diffs: RegionDiff[] = []
  const simpleFields: (keyof Region)[] = ['name', 'category', 'order', 'description', 'status', 'hidden']
  for (const field of simpleFields) {
    const oldVal = before[field]
    const newVal = after[field]
    diffs.push({
      field,
      oldValue: oldVal,
      newValue: newVal,
      changed: JSON.stringify(oldVal) !== JSON.stringify(newVal)
    })
  }
  const posFields: (keyof RegionPosition)[] = ['x', 'y', 'width', 'height']
  for (const field of posFields) {
    const oldVal = before.position[field]
    const newVal = after.position[field]
    diffs.push({
      field: `position.${field}`,
      oldValue: oldVal,
      newValue: newVal,
      changed: Math.abs(oldVal - newVal) > 0.001
    })
  }
  return diffs
}

export function buildRegionFromDiff(base: Region, diffs: RegionDiff[]): Region {
  const result: Region = JSON.parse(JSON.stringify(base))
  for (const diff of diffs) {
    if (!diff.changed) continue
    if (diff.field.startsWith('position.')) {
      const posField = diff.field.replace('position.', '') as keyof RegionPosition
      result.position[posField] = diff.newValue as number
    } else {
      (result as unknown as Record<string, unknown>)[diff.field] = diff.newValue
    }
  }
  return result
}

export function createTemplateFromRegion(
  region: Region,
  pageWidth: number,
  pageHeight: number
): RegionTemplate {
  return {
    id: uuidv4(),
    name: region.name,
    category: region.category,
    position: { ...region.position },
    pageWidth,
    pageHeight,
    description: `从「${region.name}」提取的模板`,
    usageCount: 0,
    createdAt: Date.now()
  }
}

export function deduplicateCandidates(candidates: CandidateRegion[]): CandidateRegion[] {
  const result: CandidateRegion[] = []
  const used = new Set<string>()

  for (const c of candidates) {
    if (used.has(c.id)) continue
    result.push(c)
    for (const other of candidates) {
      if (other.id === c.id) continue
      if (calculateIoU(c.position, other.position) > 0.8) {
        used.add(other.id)
      }
    }
  }

  return result
}

export function suggestCategoryByPosition(
  position: RegionPosition,
  pageWidth: number,
  pageHeight: number
): RegionCategory {
  const centerY = position.y + position.height / 2
  const centerX = position.x + position.width / 2
  const relativeY = centerY / pageHeight
  const relativeX = centerX / pageWidth
  const heightRatio = position.height / pageHeight

  if (heightRatio < 0.15 && relativeY < 0.25) {
    return RegionCategory.HEAD_NOTE
  }
  if (relativeX < 0.2 || relativeX > 0.8) {
    return RegionCategory.INTERLINE_NOTE
  }
  return RegionCategory.MAIN_TEXT
}
