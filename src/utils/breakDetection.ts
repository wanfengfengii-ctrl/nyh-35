import { v4 as uuidv4 } from 'uuid'
import {
  Region,
  SplitScheme,
  BreakRegion,
  BreakType,
  BreakSeverity,
  RegionPosition,
  RegionCategory,
  SpreadView,
  SpreadPage,
  SpreadLayout
} from '@/types'

const CATEGORY_TO_BREAK_TYPE: Record<RegionCategory, BreakType> = {
  [RegionCategory.MAIN_TEXT]: BreakType.TEXT_BREAK,
  [RegionCategory.HEAD_NOTE]: BreakType.HEAD_NOTE_BREAK,
  [RegionCategory.INTERLINE_NOTE]: BreakType.INTERLINE_NOTE_BREAK,
  [RegionCategory.IMAGE]: BreakType.IMAGE_BREAK,
  [RegionCategory.TITLE_LABEL]: BreakType.TITLE_LABEL_BREAK,
  [RegionCategory.DAMAGED]: BreakType.TEXT_BREAK
}

const SEAM_DETECTION_THRESHOLD = 15
const VERTICAL_ALIGNMENT_THRESHOLD = 20
const HEIGHT_DIFF_THRESHOLD = 0.15

function isNearSeam(
  region: Region,
  pageWidth: number,
  isLeftPage: boolean,
  threshold: number = SEAM_DETECTION_THRESHOLD
): boolean {
  if (isLeftPage) {
    return region.position.x + region.position.width >= pageWidth - threshold
  } else {
    return region.position.x <= threshold
  }
}

function getSeamEdgeX(
  region: Region,
  pageWidth: number,
  isLeftPage: boolean
): number {
  return isLeftPage
    ? region.position.x + region.position.width
    : region.position.x
}

function calculateVerticalOverlap(
  a: Region,
  b: Region,
  aOffsetY: number = 0,
  bOffsetY: number = 0
): number {
  const aY1 = a.position.y + aOffsetY
  const aY2 = aY1 + a.position.height
  const bY1 = b.position.y + bOffsetY
  const bY2 = bY1 + b.position.height

  const overlapStart = Math.max(aY1, bY1)
  const overlapEnd = Math.min(aY2, bY2)

  return Math.max(0, overlapEnd - overlapStart)
}

export function detectCategoryBreaks(
  leftRegions: Region[],
  rightRegions: Region[],
  leftPageWidth: number,
  rightPageWidth: number,
  leftOffsetY: number = 0,
  rightOffsetY: number = 0,
  category: RegionCategory,
  pageGap: number = 20
): BreakRegion[] {
  const breaks: BreakRegion[] = []

  const leftCandidates = leftRegions.filter(
    (r) => r.category === category && !r.hidden && isNearSeam(r, leftPageWidth, true)
  )
  const rightCandidates = rightRegions.filter(
    (r) => r.category === category && !r.hidden && isNearSeam(r, rightPageWidth, false)
  )

  for (const left of leftCandidates) {
    for (const right of rightCandidates) {
      const verticalOverlap = calculateVerticalOverlap(left, right, leftOffsetY, rightOffsetY)
      const minHeight = Math.min(left.position.height, right.position.height)
      const overlapRatio = minHeight > 0 ? verticalOverlap / minHeight : 0

      const leftEdgeX = getSeamEdgeX(left, leftPageWidth, true)
      const rightEdgeX = getSeamEdgeX(right, rightPageWidth, false)
      const leftDistToSeam = leftPageWidth - leftEdgeX
      const rightDistToSeam = rightEdgeX

      const heightDiffRatio =
        Math.abs(left.position.height - right.position.height) /
        Math.max(left.position.height, right.position.height)

      const shouldDetect =
        overlapRatio > 0.3 ||
        (Math.abs((left.position.y + leftOffsetY) - (right.position.y + rightOffsetY)) <
          VERTICAL_ALIGNMENT_THRESHOLD &&
          heightDiffRatio < HEIGHT_DIFF_THRESHOLD)

      if (shouldDetect) {
        let severity: BreakSeverity = BreakSeverity.LOW
        if (overlapRatio > 0.8 && (leftDistToSeam < 5 || rightDistToSeam < 5)) {
          severity = BreakSeverity.HIGH
        } else if (overlapRatio > 0.5 || heightDiffRatio < 0.1) {
          severity = BreakSeverity.MEDIUM
        }

        const minY = Math.min(left.position.y + leftOffsetY, right.position.y + rightOffsetY)
        const maxY = Math.max(
          left.position.y + left.position.height + leftOffsetY,
          right.position.height + right.position.y + rightOffsetY
        )

        const breakPos: RegionPosition = {
          x: leftPageWidth - 5,
          y: minY,
          width: pageGap + 10,
          height: maxY - minY
        }

        const breakType = CATEGORY_TO_BREAK_TYPE[category]
        breaks.push({
          id: uuidv4(),
          breakType,
          severity,
          leftRegionId: left.id,
          rightRegionId: right.id,
          position: breakPos,
          description: `${getCategoryLabel(category)}区域「${left.name}」与「${right.name}」在页缝处疑似断裂，垂直重叠${(overlapRatio * 100).toFixed(1)}%`,
          detectedAt: Date.now(),
          reviewed: false,
          reviewer: null,
          reviewComment: '',
          resolved: false,
          resolvedAt: null
        })
      }
    }
  }

  return breaks
}

function getCategoryLabel(category: RegionCategory): string {
  const labels: Record<RegionCategory, string> = {
    [RegionCategory.MAIN_TEXT]: '正文栏',
    [RegionCategory.HEAD_NOTE]: '眉批',
    [RegionCategory.INTERLINE_NOTE]: '夹注',
    [RegionCategory.IMAGE]: '图像',
    [RegionCategory.TITLE_LABEL]: '题签',
    [RegionCategory.DAMAGED]: '缺损区'
  }
  return labels[category]
}

export function detectColumnMisalignment(
  leftScheme: SplitScheme,
  rightScheme: SplitScheme,
  leftOffsetY: number = 0,
  rightOffsetY: number = 0,
  leftPageWidth: number = 0,
  pageGap: number = 20
): BreakRegion[] {
  const breaks: BreakRegion[] = []

  const leftMain = leftScheme.regions
    .filter((r) => r.category === RegionCategory.MAIN_TEXT && !r.hidden)
    .sort((a, b) => a.position.x - b.position.x)
  const rightMain = rightScheme.regions
    .filter((r) => r.category === RegionCategory.MAIN_TEXT && !r.hidden)
    .sort((a, b) => a.position.x - b.position.x)

  if (leftMain.length === 0 || rightMain.length === 0) return breaks

  const leftRightmost = leftMain[leftMain.length - 1]
  const rightLeftmost = rightMain[0]

  const leftBottom = leftRightmost.position.y + leftRightmost.position.height + leftOffsetY
  const rightBottom = rightLeftmost.position.y + rightLeftmost.position.height + rightOffsetY
  const leftTop = leftRightmost.position.y + leftOffsetY
  const rightTop = rightLeftmost.position.y + rightOffsetY

  const topDiff = Math.abs(leftTop - rightTop)
  const bottomDiff = Math.abs(leftBottom - rightBottom)

  if (topDiff > VERTICAL_ALIGNMENT_THRESHOLD || bottomDiff > VERTICAL_ALIGNMENT_THRESHOLD) {
    let severity: BreakSeverity = BreakSeverity.LOW
    if (topDiff > 40 || bottomDiff > 40) {
      severity = BreakSeverity.HIGH
    } else if (topDiff > 25 || bottomDiff > 25) {
      severity = BreakSeverity.MEDIUM
    }

    const minY = Math.min(leftTop, rightTop)
    const maxY = Math.max(leftBottom, rightBottom)
    const seamCenterX = leftPageWidth + pageGap / 2

    breaks.push({
      id: uuidv4(),
      breakType: BreakType.COLUMN_MISALIGNMENT,
      severity,
      leftRegionId: leftRightmost.id,
      rightRegionId: rightLeftmost.id,
      position: {
        x: seamCenterX - 8,
        y: minY,
        width: 16,
        height: maxY - minY
      },
      description: `栏线错位：顶部差异${topDiff.toFixed(1)}px，底部差异${bottomDiff.toFixed(1)}px`,
      detectedAt: Date.now(),
      reviewed: false,
      reviewer: null,
      reviewComment: '',
      resolved: false,
      resolvedAt: null
    })
  }

  return breaks
}

export function detectSeamGap(
  spread: SpreadView,
  leftPage: SpreadPage,
  rightPage: SpreadPage
): BreakRegion[] {
  const breaks: BreakRegion[] = []
  const gap = spread.pageGap
  const expectedGap = 20

  if (Math.abs(gap - expectedGap) > 30) {
    let severity: BreakSeverity = BreakSeverity.LOW
    if (Math.abs(gap - expectedGap) > 80) {
      severity = BreakSeverity.HIGH
    } else if (Math.abs(gap - expectedGap) > 50) {
      severity = BreakSeverity.MEDIUM
    }

    const avgHeight = (leftPage.image.height + rightPage.image.height) / 2

    breaks.push({
      id: uuidv4(),
      breakType: BreakType.SEAM_GAP,
      severity,
      leftRegionId: null,
      rightRegionId: null,
      position: {
        x: leftPage.image.width - 5,
        y: 0,
        width: gap + 10,
        height: avgHeight
      },
      description: `页缝间距异常：当前${gap}px，标准约${expectedGap}px，偏差${Math.abs(gap - expectedGap).toFixed(1)}px`,
      detectedAt: Date.now(),
      reviewed: false,
      reviewer: null,
      reviewComment: '',
      resolved: false,
      resolvedAt: null
    })
  }

  return breaks
}

export function detectAllBreaks(
  spread: SpreadView
): BreakRegion[] {
  const allBreaks: BreakRegion[] = []
  const { left, right } = getPagesFromSpread(spread)

  if (!left || !right || !left.scheme || !right.scheme) {
    return allBreaks
  }

  const categories: RegionCategory[] = [
    RegionCategory.MAIN_TEXT,
    RegionCategory.HEAD_NOTE,
    RegionCategory.INTERLINE_NOTE,
    RegionCategory.IMAGE,
    RegionCategory.TITLE_LABEL
  ]

  for (const category of categories) {
    const breaks = detectCategoryBreaks(
      left.scheme.regions,
      right.scheme.regions,
      left.image.width,
      right.image.width,
      left.offset.offsetY,
      right.offset.offsetY,
      category,
      spread.pageGap
    )
    allBreaks.push(...breaks)
  }

  allBreaks.push(
    ...detectColumnMisalignment(
      left.scheme,
      right.scheme,
      left.offset.offsetY,
      right.offset.offsetY,
      left.image.width,
      spread.pageGap
    )
  )

  allBreaks.push(...detectSeamGap(spread, left, right))

  return allBreaks
}

function getPagesFromSpread(spread: SpreadView): { left: SpreadPage | null; right: SpreadPage | null } {
  if (spread.pages.length === 0) {
    return { left: null, right: null }
  }
  if (spread.pages.length === 1) {
    return spread.layout === SpreadLayout.LEFT_RIGHT
      ? { left: spread.pages[0], right: null }
      : { left: null, right: spread.pages[0] }
  }
  return spread.layout === SpreadLayout.LEFT_RIGHT
    ? { left: spread.pages[0], right: spread.pages[1] }
    : { left: spread.pages[1], right: spread.pages[0] }
}

export function reviewBreakRegion(
  breakRegion: BreakRegion,
  reviewer: string,
  comment: string,
  resolved: boolean
): BreakRegion {
  return {
    ...breakRegion,
    reviewed: true,
    reviewer,
    reviewComment: comment,
    resolved,
    resolvedAt: resolved ? Date.now() : null
  }
}

export function getBreakSeverityColor(severity: BreakSeverity): string {
  const colors: Record<BreakSeverity, string> = {
    [BreakSeverity.LOW]: '#F59E0B',
    [BreakSeverity.MEDIUM]: '#EF4444',
    [BreakSeverity.HIGH]: '#DC2626'
  }
  return colors[severity]
}

export function getBreakTypeColor(type: BreakType): string {
  const colors: Record<BreakType, string> = {
    [BreakType.TEXT_BREAK]: '#409EFF',
    [BreakType.HEAD_NOTE_BREAK]: '#67C23A',
    [BreakType.INTERLINE_NOTE_BREAK]: '#E6A23C',
    [BreakType.IMAGE_BREAK]: '#909399',
    [BreakType.TITLE_LABEL_BREAK]: '#F56C6C',
    [BreakType.COLUMN_MISALIGNMENT]: '#8B5CF6',
    [BreakType.SEAM_GAP]: '#06B6D4'
  }
  return colors[type]
}
