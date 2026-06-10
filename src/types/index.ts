export enum RegionCategory {
  MAIN_TEXT = 'main_text',
  HEAD_NOTE = 'head_note',
  INTERLINE_NOTE = 'interline_note',
  IMAGE = 'image',
  TITLE_LABEL = 'title_label',
  DAMAGED = 'damaged'
}

export const RegionCategoryLabel: Record<RegionCategory, string> = {
  [RegionCategory.MAIN_TEXT]: '正文栏',
  [RegionCategory.HEAD_NOTE]: '眉批',
  [RegionCategory.INTERLINE_NOTE]: '夹注',
  [RegionCategory.IMAGE]: '图像',
  [RegionCategory.TITLE_LABEL]: '题签',
  [RegionCategory.DAMAGED]: '缺损区'
}

export const RegionCategoryColor: Record<RegionCategory, string> = {
  [RegionCategory.MAIN_TEXT]: '#409EFF',
  [RegionCategory.HEAD_NOTE]: '#67C23A',
  [RegionCategory.INTERLINE_NOTE]: '#E6A23C',
  [RegionCategory.IMAGE]: '#909399',
  [RegionCategory.TITLE_LABEL]: '#F56C6C',
  [RegionCategory.DAMAGED]: '#8B5A2B'
}

export enum RegionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  REVIEWED = 'reviewed',
  FINALIZED = 'finalized'
}

export const RegionStatusLabel: Record<RegionStatus, string> = {
  [RegionStatus.PENDING]: '待处理',
  [RegionStatus.IN_PROGRESS]: '整理中',
  [RegionStatus.REVIEWED]: '已复核',
  [RegionStatus.FINALIZED]: '已定稿'
}

export interface RegionPosition {
  x: number
  y: number
  width: number
  height: number
}

export interface Region {
  id: string
  name: string
  category: RegionCategory
  order: number
  description: string
  status: RegionStatus
  hidden: boolean
  position: RegionPosition
}

export interface SplitScheme {
  id: string
  name: string
  author: string
  createdAt: number
  updatedAt: number
  pageImageData: string
  regions: Region[]
}

export interface PageImage {
  id: string
  name: string
  dataUrl: string
  width: number
  height: number
}

export interface ValidationResult {
  valid: boolean
  message: string
}

export interface RegionStat {
  category: RegionCategory
  count: number
  area: number
  areaRatio: number
}

export interface SchemeStats {
  totalRegions: number
  visibleRegions: number
  totalArea: number
  visibleArea: number
  statsByCategory: RegionStat[]
}
