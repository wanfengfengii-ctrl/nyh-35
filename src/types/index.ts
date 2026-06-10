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

export enum CandidateStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  MODIFIED = 'modified'
}

export const CandidateStatusLabel: Record<CandidateStatus, string> = {
  [CandidateStatus.PENDING]: '待处理',
  [CandidateStatus.ACCEPTED]: '已采纳',
  [CandidateStatus.REJECTED]: '已拒绝',
  [CandidateStatus.MODIFIED]: '已修改'
}

export interface CandidateRegion {
  id: string
  templateId: string
  templateName: string
  category: RegionCategory
  position: RegionPosition
  confidence: number
  status: CandidateStatus
  matchedRegionId: string | null
  suggestion: string
}

export interface RegionTemplate {
  id: string
  name: string
  category: RegionCategory
  position: RegionPosition
  pageWidth: number
  pageHeight: number
  description: string
  usageCount: number
  createdAt: number
}

export enum ReviewDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
  MODIFY = 'modify',
  PENDING = 'pending'
}

export const ReviewDecisionLabel: Record<ReviewDecision, string> = {
  [ReviewDecision.APPROVE]: '通过',
  [ReviewDecision.REJECT]: '驳回',
  [ReviewDecision.MODIFY]: '需修改',
  [ReviewDecision.PENDING]: '待复核'
}

export interface ReviewOpinion {
  id: string
  reviewer: string
  regionId: string
  decision: ReviewDecision
  comment: string
  proposedChanges: Partial<Region> | null
  createdAt: number
}

export interface ConflictInfo {
  id: string
  type: 'overlap' | 'category_mismatch' | 'order_conflict' | 'boundary_deviation'
  regionIds: string[]
  severity: 'low' | 'medium' | 'high'
  description: string
  resolved: boolean
}

export interface ReviewLogEntry {
  id: string
  timestamp: number
  reviewer: string
  action: string
  regionId: string | null
  schemeId: string
  details: string
  before: unknown | null
  after: unknown | null
}

export interface SchemeVersion {
  id: string
  schemeId: string
  versionNumber: number
  name: string
  snapshot: SplitScheme
  createdAt: number
  createdBy: string
  description: string
  reviewCount: number
}

export interface BatchReport {
  schemeId: string
  schemeName: string
  generatedAt: number
  totalRegions: number
  regionsByStatus: Record<RegionStatus, number>
  regionsByCategory: Record<RegionCategory, number>
  autoAcceptedCount: number
  manualReviewedCount: number
  conflictCount: number
  resolvedConflictCount: number
  reviewerContributions: Record<string, number>
  averageConfidence: number
  totalArea: number
  areaByCategory: Record<RegionCategory, number>
}

export interface RegionDiff {
  field: string
  oldValue: unknown
  newValue: unknown
  changed: boolean
}

export enum SpreadLayout {
  LEFT_RIGHT = 'left_right',
  RIGHT_LEFT = 'right_left'
}

export const SpreadLayoutLabel: Record<SpreadLayout, string> = {
  [SpreadLayout.LEFT_RIGHT]: '左页-右页（西式）',
  [SpreadLayout.RIGHT_LEFT]: '右页-左页（中式）'
}

export interface PageOffset {
  offsetX: number
  offsetY: number
  scale: number
  rotation: number
}

export interface SpreadPage {
  pageId: string
  pageIndex: number
  image: PageImage
  scheme: SplitScheme | null
  offset: PageOffset
}

export interface SpreadView {
  id: string
  name: string
  layout: SpreadLayout
  pages: SpreadPage[]
  pageGap: number
  createdAt: number
  updatedAt: number
}

export enum AlignmentMethod {
  MANUAL = 'manual',
  BLOCK_CENTER = 'block_center',
  COLUMN_LINE = 'column_line',
  CONTENT_FEATURE = 'content_feature'
}

export const AlignmentMethodLabel: Record<AlignmentMethod, string> = {
  [AlignmentMethod.MANUAL]: '手动对齐',
  [AlignmentMethod.BLOCK_CENTER]: '版心中心对齐',
  [AlignmentMethod.COLUMN_LINE]: '栏线对齐',
  [AlignmentMethod.CONTENT_FEATURE]: '内容特征对齐'
}

export interface AlignmentResult {
  method: AlignmentMethod
  success: boolean
  confidence: number
  offsetX: number
  offsetY: number
  scale: number
  rotation: number
  details: string
}

export enum BreakType {
  TEXT_BREAK = 'text_break',
  HEAD_NOTE_BREAK = 'head_note_break',
  INTERLINE_NOTE_BREAK = 'interline_note_break',
  IMAGE_BREAK = 'image_break',
  TITLE_LABEL_BREAK = 'title_label_break',
  COLUMN_MISALIGNMENT = 'column_misalignment',
  SEAM_GAP = 'seam_gap'
}

export const BreakTypeLabel: Record<BreakType, string> = {
  [BreakType.TEXT_BREAK]: '正文断裂',
  [BreakType.HEAD_NOTE_BREAK]: '眉批断裂',
  [BreakType.INTERLINE_NOTE_BREAK]: '夹注断裂',
  [BreakType.IMAGE_BREAK]: '图像断裂',
  [BreakType.TITLE_LABEL_BREAK]: '题签断裂',
  [BreakType.COLUMN_MISALIGNMENT]: '栏线错位',
  [BreakType.SEAM_GAP]: '页缝异常'
}

export enum BreakSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export const BreakSeverityLabel: Record<BreakSeverity, string> = {
  [BreakSeverity.LOW]: '轻微',
  [BreakSeverity.MEDIUM]: '中等',
  [BreakSeverity.HIGH]: '严重'
}

export interface BreakRegion {
  id: string
  breakType: BreakType
  severity: BreakSeverity
  leftRegionId: string | null
  rightRegionId: string | null
  position: RegionPosition
  description: string
  detectedAt: number
  reviewed: boolean
  reviewer: string | null
  reviewComment: string
  resolved: boolean
  resolvedAt: number | null
}

export enum ProofreadingStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  REVIEWED = 'reviewed',
  FINALIZED = 'finalized'
}

export const ProofreadingStatusLabel: Record<ProofreadingStatus, string> = {
  [ProofreadingStatus.NOT_STARTED]: '未开始',
  [ProofreadingStatus.IN_PROGRESS]: '校对中',
  [ProofreadingStatus.REVIEWED]: '已复核',
  [ProofreadingStatus.FINALIZED]: '已定稿'
}

export interface ProofreadingRecord {
  id: string
  spreadId: string
  operator: string
  status: ProofreadingStatus
  startTime: number
  endTime: number | null
  notes: string
  reviewedBy: string | null
  reviewedAt: number | null
  reviewResult: string
}

export interface SpreadConsistencyIssue {
  id: string
  breakId: string
  breakType: BreakType
  severity: BreakSeverity
  description: string
  suggestion: string
  leftPage: number
  rightPage: number
}

export interface SpreadConsistencyReport {
  id: string
  spreadId: string
  spreadName: string
  generatedAt: number
  generatedBy: string
  totalIssues: number
  issuesByType: Record<BreakType, number>
  issuesBySeverity: Record<BreakSeverity, number>
  resolvedCount: number
  unresolvedCount: number
  alignmentConfidence: number
  proofreadingStatus: ProofreadingStatus
  issues: SpreadConsistencyIssue[]
  summary: string
}

export interface ColumnLine {
  x: number
  y1: number
  y2: number
  pageIndex: number
}

export interface BlockCenter {
  x: number
  y: number
  width: number
  height: number
  pageIndex: number
}
