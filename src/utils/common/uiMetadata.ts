import {
  RegionStatus,
  IssueStatus,
  IssuePriority,
  BreakSeverity,
  ProofreadingStatus,
  BookStatus,
  RegionCategory
} from '@/types'

export type TagType = 'default' | 'info' | 'success' | 'warning' | 'error'

export const regionStatusTagType: Record<RegionStatus, TagType> = {
  [RegionStatus.PENDING]: 'default',
  [RegionStatus.IN_PROGRESS]: 'warning',
  [RegionStatus.REVIEWED]: 'info',
  [RegionStatus.FINALIZED]: 'success'
}

export const issueStatusTagType: Record<IssueStatus, TagType> = {
  [IssueStatus.OPEN]: 'default',
  [IssueStatus.ASSIGNED]: 'info',
  [IssueStatus.IN_PROGRESS]: 'warning',
  [IssueStatus.PENDING_REVIEW]: 'warning',
  [IssueStatus.RESOLVED]: 'success',
  [IssueStatus.CLOSED]: 'success'
}

export const issuePriorityTagType: Record<IssuePriority, TagType> = {
  [IssuePriority.LOW]: 'default',
  [IssuePriority.MEDIUM]: 'info',
  [IssuePriority.HIGH]: 'warning',
  [IssuePriority.URGENT]: 'error'
}

export const breakSeverityTagType: Record<BreakSeverity, TagType> = {
  [BreakSeverity.LOW]: 'default',
  [BreakSeverity.MEDIUM]: 'warning',
  [BreakSeverity.HIGH]: 'error'
}

export const proofreadingStatusTagType: Record<ProofreadingStatus, TagType> = {
  [ProofreadingStatus.NOT_STARTED]: 'default',
  [ProofreadingStatus.IN_PROGRESS]: 'warning',
  [ProofreadingStatus.REVIEWED]: 'info',
  [ProofreadingStatus.FINALIZED]: 'success'
}

export const bookStatusTagType: Record<BookStatus, TagType> = {
  [BookStatus.NOT_STARTED]: 'default',
  [BookStatus.IN_PROGRESS]: 'warning',
  [BookStatus.REVIEWED]: 'info',
  [BookStatus.FINALIZED]: 'success'
}

export const regionCategoryColor: Record<RegionCategory, string> = {
  [RegionCategory.MAIN_TEXT]: '#409EFF',
  [RegionCategory.HEAD_NOTE]: '#67C23A',
  [RegionCategory.INTERLINE_NOTE]: '#E6A23C',
  [RegionCategory.IMAGE]: '#909399',
  [RegionCategory.TITLE_LABEL]: '#F56C6C',
  [RegionCategory.DAMAGED]: '#8B5A2B'
}

export function getIssueStatusTagType(status: IssueStatus): TagType {
  return issueStatusTagType[status]
}

export function getIssuePriorityTagType(priority: IssuePriority): TagType {
  return issuePriorityTagType[priority]
}

export function getBreakSeverityTagType(severity: BreakSeverity): TagType {
  return breakSeverityTagType[severity]
}

export function getRegionStatusTagType(status: RegionStatus): TagType {
  return regionStatusTagType[status]
}

export function getProofreadingStatusTagType(status: ProofreadingStatus): TagType {
  return proofreadingStatusTagType[status]
}

export function getBookStatusTagType(status: BookStatus): TagType {
  return bookStatusTagType[status]
}
