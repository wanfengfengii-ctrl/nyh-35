import {
  RegionStatus,
  IssueStatus,
  ProofreadingStatus,
  BookStatus,
  CandidateStatus,
  ReviewDecision,
  ReviewResult
} from '@/types'

export interface StatusTransition<T> {
  from: T
  to: T
  allowed: boolean
  reason?: string
}

export const regionStatusFlow: StatusTransition<RegionStatus>[] = [
  { from: RegionStatus.PENDING, to: RegionStatus.IN_PROGRESS, allowed: true },
  { from: RegionStatus.PENDING, to: RegionStatus.REVIEWED, allowed: true },
  { from: RegionStatus.PENDING, to: RegionStatus.FINALIZED, allowed: false, reason: '需先经过复核才能定稿' },
  { from: RegionStatus.IN_PROGRESS, to: RegionStatus.REVIEWED, allowed: true },
  { from: RegionStatus.IN_PROGRESS, to: RegionStatus.FINALIZED, allowed: false, reason: '需先经过复核才能定稿' },
  { from: RegionStatus.REVIEWED, to: RegionStatus.FINALIZED, allowed: true },
  { from: RegionStatus.REVIEWED, to: RegionStatus.IN_PROGRESS, allowed: true, reason: '复核打回修改' },
  { from: RegionStatus.FINALIZED, to: RegionStatus.REVIEWED, allowed: true, reason: '回退到已复核状态' }
]

export const issueStatusFlow: StatusTransition<IssueStatus>[] = [
  { from: IssueStatus.OPEN, to: IssueStatus.ASSIGNED, allowed: true },
  { from: IssueStatus.OPEN, to: IssueStatus.CLOSED, allowed: true, reason: '直接关闭无效问题' },
  { from: IssueStatus.ASSIGNED, to: IssueStatus.IN_PROGRESS, allowed: true },
  { from: IssueStatus.ASSIGNED, to: IssueStatus.OPEN, allowed: true, reason: '取消分配' },
  { from: IssueStatus.IN_PROGRESS, to: IssueStatus.PENDING_REVIEW, allowed: true },
  { from: IssueStatus.IN_PROGRESS, to: IssueStatus.ASSIGNED, allowed: true },
  { from: IssueStatus.PENDING_REVIEW, to: IssueStatus.RESOLVED, allowed: true },
  { from: IssueStatus.PENDING_REVIEW, to: IssueStatus.IN_PROGRESS, allowed: true, reason: '复核打回修改' },
  { from: IssueStatus.PENDING_REVIEW, to: IssueStatus.CLOSED, allowed: true, reason: '复核通过直接关闭' },
  { from: IssueStatus.RESOLVED, to: IssueStatus.CLOSED, allowed: true },
  { from: IssueStatus.RESOLVED, to: IssueStatus.IN_PROGRESS, allowed: true, reason: '重新打开' },
  { from: IssueStatus.CLOSED, to: IssueStatus.IN_PROGRESS, allowed: true, reason: '重新打开' }
]

export const proofreadingStatusFlow: StatusTransition<ProofreadingStatus>[] = [
  { from: ProofreadingStatus.NOT_STARTED, to: ProofreadingStatus.IN_PROGRESS, allowed: true },
  { from: ProofreadingStatus.IN_PROGRESS, to: ProofreadingStatus.REVIEWED, allowed: true },
  { from: ProofreadingStatus.IN_PROGRESS, to: ProofreadingStatus.FINALIZED, allowed: false, reason: '需先经过复核才能定稿' },
  { from: ProofreadingStatus.REVIEWED, to: ProofreadingStatus.FINALIZED, allowed: true },
  { from: ProofreadingStatus.REVIEWED, to: ProofreadingStatus.IN_PROGRESS, allowed: true, reason: '复核打回修改' },
  { from: ProofreadingStatus.FINALIZED, to: ProofreadingStatus.REVIEWED, allowed: true, reason: '回退到已复核状态' }
]

export const bookStatusFlow: StatusTransition<BookStatus>[] = [
  { from: BookStatus.NOT_STARTED, to: BookStatus.IN_PROGRESS, allowed: true },
  { from: BookStatus.IN_PROGRESS, to: BookStatus.REVIEWED, allowed: true },
  { from: BookStatus.IN_PROGRESS, to: BookStatus.FINALIZED, allowed: false, reason: '需先经过复核才能定稿' },
  { from: BookStatus.REVIEWED, to: BookStatus.FINALIZED, allowed: true },
  { from: BookStatus.REVIEWED, to: BookStatus.IN_PROGRESS, allowed: true, reason: '复核打回修改' },
  { from: BookStatus.FINALIZED, to: BookStatus.REVIEWED, allowed: true, reason: '回退到已复核状态' }
]

export function canTransition<T>(
  transitions: StatusTransition<T>[],
  from: T,
  to: T
): { allowed: boolean; reason?: string } {
  if (from === to) return { allowed: true }
  const transition = transitions.find((t) => t.from === from && t.to === to)
  if (!transition) return { allowed: false, reason: `不允许从「${from}」变更为「${to}」` }
  return { allowed: transition.allowed, reason: transition.reason }
}

export function canTransitionRegion(from: RegionStatus, to: RegionStatus) {
  return canTransition(regionStatusFlow, from, to)
}

export function canTransitionIssue(from: IssueStatus, to: IssueStatus) {
  return canTransition(issueStatusFlow, from, to)
}

export function canTransitionProofreading(from: ProofreadingStatus, to: ProofreadingStatus) {
  return canTransition(proofreadingStatusFlow, from, to)
}

export function canTransitionBook(from: BookStatus, to: BookStatus) {
  return canTransition(bookStatusFlow, from, to)
}

export function reviewDecisionToRegionStatus(decision: ReviewDecision): RegionStatus | null {
  switch (decision) {
    case ReviewDecision.APPROVE:
      return RegionStatus.REVIEWED
    case ReviewDecision.MODIFY:
    case ReviewDecision.REJECT:
      return RegionStatus.IN_PROGRESS
    default:
      return null
  }
}

export function reviewResultToIssueStatus(result: ReviewResult): IssueStatus {
  switch (result) {
    case ReviewResult.APPROVED:
      return IssueStatus.CLOSED
    case ReviewResult.REJECTED:
    case ReviewResult.NEEDS_REVISION:
      return IssueStatus.IN_PROGRESS
  }
}

export function candidateStatusLabel(status: CandidateStatus): string {
  const labels: Record<CandidateStatus, string> = {
    [CandidateStatus.PENDING]: '待处理',
    [CandidateStatus.ACCEPTED]: '已采纳',
    [CandidateStatus.REJECTED]: '已拒绝',
    [CandidateStatus.MODIFIED]: '已修改'
  }
  return labels[status] || status
}
