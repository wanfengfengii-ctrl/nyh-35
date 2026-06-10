import { v4 as uuidv4 } from 'uuid'
import {
  Region,
  SplitScheme,
  PageImage,
  SpreadView,
  SpreadPage,
  SpreadLayout,
  PageOffset,
  AlignmentResult,
  AlignmentMethod,
  BreakRegion,
  BreakType,
  BreakSeverity,
  RegionPosition,
  RegionCategory,
  ColumnLine,
  BlockCenter,
  SpreadConsistencyReport,
  SpreadConsistencyIssue,
  ProofreadingRecord,
  ProofreadingStatus
} from '@/types'
import { calculateRegionArea } from './statistics'

export function createDefaultPageOffset(): PageOffset {
  return {
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    rotation: 0
  }
}

export function createSpreadView(
  name: string,
  layout: SpreadLayout = SpreadLayout.RIGHT_LEFT,
  pageGap: number = 20
): SpreadView {
  return {
    id: uuidv4(),
    name,
    layout,
    pages: [],
    pageGap,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

export function addPageToSpread(
  spread: SpreadView,
  image: PageImage,
  scheme: SplitScheme | null = null
): SpreadView {
  const newPage: SpreadPage = {
    pageId: uuidv4(),
    pageIndex: spread.pages.length,
    image,
    scheme,
    offset: createDefaultPageOffset()
  }
  const updated = {
    ...spread,
    pages: [...spread.pages, newPage],
    updatedAt: Date.now()
  }
  return updated
}

export function removePageFromSpread(
  spread: SpreadView,
  pageId: string
): SpreadView {
  const pages = spread.pages
    .filter((p) => p.pageId !== pageId)
    .map((p, idx) => ({ ...p, pageIndex: idx }))
  return {
    ...spread,
    pages,
    updatedAt: Date.now()
  }
}

export function updatePageOffset(
  spread: SpreadView,
  pageId: string,
  offset: Partial<PageOffset>
): SpreadView {
  const pages = spread.pages.map((p) =>
    p.pageId === pageId
      ? { ...p, offset: { ...p.offset, ...offset } }
      : p
  )
  return {
    ...spread,
    pages,
    updatedAt: Date.now()
  }
}

export function reorderPages(
  spread: SpreadView,
  fromIndex: number,
  toIndex: number
): SpreadView {
  const pages = [...spread.pages]
  const [removed] = pages.splice(fromIndex, 1)
  pages.splice(toIndex, 0, removed)
  const reordered = pages.map((p, idx) => ({ ...p, pageIndex: idx }))
  return {
    ...spread,
    pages: reordered,
    updatedAt: Date.now()
  }
}

export function getPagesByLayout(
  spread: SpreadView
): { left: SpreadPage | null; right: SpreadPage | null } {
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

export function extractBlockCenter(
  scheme: SplitScheme,
  pageIndex: number
): BlockCenter | null {
  const mainTextRegions = scheme.regions.filter(
    (r) => r.category === RegionCategory.MAIN_TEXT && !r.hidden
  )
  if (mainTextRegions.length === 0) return null

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const r of mainTextRegions) {
    minX = Math.min(minX, r.position.x)
    minY = Math.min(minY, r.position.y)
    maxX = Math.max(maxX, r.position.x + r.position.width)
    maxY = Math.max(maxY, r.position.y + r.position.height)
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
    pageIndex
  }
}

export function extractColumnLines(
  scheme: SplitScheme,
  pageIndex: number
): ColumnLine[] {
  const lines: ColumnLine[] = []
  const mainTextRegions = scheme.regions
    .filter((r) => r.category === RegionCategory.MAIN_TEXT && !r.hidden)
    .sort((a, b) => a.position.x - b.position.x)

  if (mainTextRegions.length === 0) return lines

  let minY = Infinity,
    maxY = -Infinity
  for (const r of mainTextRegions) {
    minY = Math.min(minY, r.position.y)
    maxY = Math.max(maxY, r.position.y + r.position.height)
  }

  for (let i = 0; i < mainTextRegions.length; i++) {
    const r = mainTextRegions[i]
    lines.push({
      x: r.position.x,
      y1: minY,
      y2: maxY,
      pageIndex
    })
    if (i === mainTextRegions.length - 1) {
      lines.push({
        x: r.position.x + r.position.width,
        y1: minY,
        y2: maxY,
        pageIndex
      })
    }
  }

  return lines
}

export function alignByBlockCenter(
  leftScheme: SplitScheme,
  rightScheme: SplitScheme
): AlignmentResult {
  const leftCenter = extractBlockCenter(leftScheme, 0)
  const rightCenter = extractBlockCenter(rightScheme, 1)

  if (!leftCenter || !rightCenter) {
    return {
      method: AlignmentMethod.BLOCK_CENTER,
      success: false,
      confidence: 0,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 0,
      details: '无法从某一页提取版心区域，请确保两页都包含正文栏区域'
    }
  }

  const offsetX = leftCenter.x + leftCenter.width / 2
  const offsetY = leftCenter.y - rightCenter.y
  const scale = leftCenter.height > 0 ? rightCenter.height / leftCenter.height : 1
  const confidence =
    Math.abs(1 - scale) < 0.1
      ? 85
      : Math.abs(1 - scale) < 0.2
        ? 60
        : 40

  return {
    method: AlignmentMethod.BLOCK_CENTER,
    success: true,
    confidence,
    offsetX,
    offsetY,
    scale: Math.min(1.2, Math.max(0.8, scale)),
    rotation: 0,
    details: `基于版心中心对齐，偏移(${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})，缩放${(scale * 100).toFixed(1)}%`
  }
}

export function alignByColumnLine(
  leftScheme: SplitScheme,
  rightScheme: SplitScheme
): AlignmentResult {
  const leftLines = extractColumnLines(leftScheme, 0)
  const rightLines = extractColumnLines(rightScheme, 1)

  if (leftLines.length < 2 || rightLines.length < 2) {
    return {
      method: AlignmentMethod.COLUMN_LINE,
      success: false,
      confidence: 0,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 0,
      details: '无法提取足够的栏线信息，请确保两页都有多个正文栏'
    }
  }

  const leftRightmost = leftLines[leftLines.length - 1]
  const rightLeftmost = rightLines[0]

  const offsetY = leftRightmost.y1 - rightLeftmost.y1
  const leftHeight = leftRightmost.y2 - leftRightmost.y1
  const rightHeight = rightLeftmost.y2 - rightLeftmost.y1
  const scale = leftHeight > 0 ? rightHeight / leftHeight : 1

  const verticalDiff = Math.abs(offsetY)
  const confidence = verticalDiff < 10 ? 90 : verticalDiff < 30 ? 70 : 50

  return {
    method: AlignmentMethod.COLUMN_LINE,
    success: true,
    confidence,
    offsetX: 0,
    offsetY,
    scale: Math.min(1.15, Math.max(0.85, scale)),
    rotation: 0,
    details: `基于栏线垂直对齐，Y轴偏移${offsetY.toFixed(1)}px，缩放${(scale * 100).toFixed(1)}%`
  }
}

export function alignByContentFeature(
  leftScheme: SplitScheme,
  rightScheme: SplitScheme,
  leftImage: PageImage,
  rightImage: PageImage
): AlignmentResult {
  const leftRegions = leftScheme.regions.filter((r) => !r.hidden)
  const rightRegions = rightScheme.regions.filter((r) => !r.hidden)

  if (leftRegions.length === 0 || rightRegions.length === 0) {
    return {
      method: AlignmentMethod.CONTENT_FEATURE,
      success: false,
      confidence: 0,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 0,
      details: '缺少足够的区域信息进行特征对齐'
    }
  }

  const avgLeftY =
    leftRegions.reduce((sum, r) => sum + r.position.y + r.position.height / 2, 0) /
    leftRegions.length
  const avgRightY =
    rightRegions.reduce((sum, r) => sum + r.position.y + r.position.height / 2, 0) /
    rightRegions.length

  const offsetY = avgLeftY - avgRightY
  const scale = leftImage.height > 0 ? rightImage.height / leftImage.height : 1

  const heightRatio = Math.abs(1 - scale)
  const confidence = heightRatio < 0.05 ? 80 : heightRatio < 0.1 ? 65 : 45

  return {
    method: AlignmentMethod.CONTENT_FEATURE,
    success: true,
    confidence,
    offsetX: 0,
    offsetY,
    scale: Math.min(1.1, Math.max(0.9, scale)),
    rotation: 0,
    details: `基于内容特征平均对齐，Y偏移${offsetY.toFixed(1)}px，缩放${(scale * 100).toFixed(1)}%`
  }
}

export function autoAlignSpread(
  spread: SpreadView,
  method: AlignmentMethod = AlignmentMethod.BLOCK_CENTER
): AlignmentResult & { updatedSpread: SpreadView } {
  const { left, right } = getPagesByLayout(spread)
  if (!left || !right || !left.scheme || !right.scheme) {
    return {
      method,
      success: false,
      confidence: 0,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 0,
      details: '缺少必要的页面或方案数据，请确保两页都已导入并关联切分方案',
      updatedSpread: spread
    }
  }

  let result: AlignmentResult
  switch (method) {
    case AlignmentMethod.BLOCK_CENTER:
      result = alignByBlockCenter(left.scheme, right.scheme)
      break
    case AlignmentMethod.COLUMN_LINE:
      result = alignByColumnLine(left.scheme, right.scheme)
      break
    case AlignmentMethod.CONTENT_FEATURE:
      result = alignByContentFeature(left.scheme, right.scheme, left.image, right.image)
      break
    default:
      result = {
        method: AlignmentMethod.MANUAL,
        success: false,
        confidence: 0,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        rotation: 0,
        details: '手动对齐模式'
      }
  }

  if (!result.success) {
    return { ...result, updatedSpread: spread }
  }

  const updatedSpread = updatePageOffset(spread, right.pageId, {
    offsetY: result.offsetY,
    scale: result.scale
  })

  return { ...result, updatedSpread }
}
