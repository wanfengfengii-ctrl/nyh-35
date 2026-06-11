import {
  IssueStatus,
  IssuePriority,
  ProofreadingStatus
} from '@/types'
import type {
  Book,
  BookSpread,
  Issue,
  BookProgress
} from '@/types'

export function calculateBookProgress(
  book: Book,
  bookSpreads: BookSpread[],
  issues: Issue[]
): BookProgress {
  const totalSpreads = bookSpreads.length
  const completedSpreads = bookSpreads.filter(
    (s) => s.proofreadingStatus === ProofreadingStatus.FINALIZED
  ).length
  const inProgressSpreads = bookSpreads.filter(
    (s) => s.proofreadingStatus === ProofreadingStatus.IN_PROGRESS
  ).length
  const pendingSpreads = bookSpreads.filter(
    (s) =>
      s.proofreadingStatus === ProofreadingStatus.NOT_STARTED ||
      s.proofreadingStatus === ProofreadingStatus.REVIEWED
  ).length

  const totalIssues = issues.length
  const openIssues = issues.filter((i) => i.status === IssueStatus.OPEN).length
  const resolvedIssues = issues.filter(
    (i) => i.status === IssueStatus.RESOLVED || i.status === IssueStatus.CLOSED
  ).length
  const closedIssues = issues.filter((i) => i.status === IssueStatus.CLOSED).length
  const highPriorityIssues = issues.filter(
    (i) => i.priority === IssuePriority.HIGH || i.priority === IssuePriority.URGENT
  ).length
  const overdueIssues = issues.filter(
    (i) =>
      i.dueDate &&
      i.dueDate < Date.now() &&
      i.status !== IssueStatus.CLOSED &&
      i.status !== IssueStatus.RESOLVED
  ).length

  const confidences = bookSpreads
    .filter((s) => s.alignmentConfidence > 0)
    .map((s) => s.alignmentConfidence)
  const alignmentAverageConfidence =
    confidences.length > 0
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : 0

  const progressPercentage =
    totalSpreads > 0 ? Math.round((completedSpreads / totalSpreads) * 100) : 0
  const overallProgress = progressPercentage

  return {
    bookId: book.id,
    totalSpreads,
    completedSpreads,
    inProgressSpreads,
    pendingSpreads,
    totalIssues,
    openIssues,
    resolvedIssues,
    closedIssues,
    highPriorityIssues,
    overdueIssues,
    alignmentAverageConfidence,
    progressPercentage,
    overallProgress,
    estimatedCompletionDate: null
  }
}
