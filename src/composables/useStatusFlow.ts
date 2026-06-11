import {
  canTransitionRegion,
  canTransitionIssue,
  canTransitionProofreading,
  canTransitionBook,
  reviewDecisionToRegionStatus,
  reviewResultToIssueStatus
} from '@/utils/common/statusFlow'
import type {
  RegionStatus,
  IssueStatus,
  ProofreadingStatus,
  BookStatus,
  ReviewDecision,
  ReviewResult
} from '@/types'
import { useNotify } from '@/utils/common/notification'

export function useStatusFlow() {
  const notify = useNotify()

  function tryTransitionRegion(
    from: RegionStatus,
    to: RegionStatus
  ): boolean {
    const result = canTransitionRegion(from, to)
    if (!result.allowed && result.reason) {
      notify.warning(result.reason)
    }
    return result.allowed
  }

  function tryTransitionIssue(
    from: IssueStatus,
    to: IssueStatus
  ): boolean {
    const result = canTransitionIssue(from, to)
    if (!result.allowed && result.reason) {
      notify.warning(result.reason)
    }
    return result.allowed
  }

  function tryTransitionProofreading(
    from: ProofreadingStatus,
    to: ProofreadingStatus
  ): boolean {
    const result = canTransitionProofreading(from, to)
    if (!result.allowed && result.reason) {
      notify.warning(result.reason)
    }
    return result.allowed
  }

  function tryTransitionBook(
    from: BookStatus,
    to: BookStatus
  ): boolean {
    const result = canTransitionBook(from, to)
    if (!result.allowed && result.reason) {
      notify.warning(result.reason)
    }
    return result.allowed
  }

  function getNextRegionStatus(decision: ReviewDecision): RegionStatus | null {
    return reviewDecisionToRegionStatus(decision)
  }

  function getNextIssueStatus(result: ReviewResult): IssueStatus {
    return reviewResultToIssueStatus(result)
  }

  return {
    tryTransitionRegion,
    tryTransitionIssue,
    tryTransitionProofreading,
    tryTransitionBook,
    getNextRegionStatus,
    getNextIssueStatus
  }
}
