import { v4 as uuidv4 } from 'uuid'
import {
  IssueStatus,
  IssuePriority,
  ReviewResult
} from '@/types'
import type {
  Issue,
  IssueFilter,
  IssueComment,
  BreakRegion,
  BreakSeverity,
  BookSpread
} from '@/types'

export function createIssueFromBreak(
  breakRegion: BreakRegion,
  bookId: string,
  spreadId: string,
  reporter: string,
  leftPageIndex?: number,
  rightPageIndex?: number
): Issue {
  const priorityMap: Record<BreakSeverity, IssuePriority> = {
    low: IssuePriority.LOW,
    medium: IssuePriority.MEDIUM,
    high: IssuePriority.HIGH
  }

  return {
    id: uuidv4(),
    bookId,
    spreadId,
    breakId: breakRegion.id,
    breakType: breakRegion.breakType,
    title:
      breakRegion.description.substring(0, 50) +
      (breakRegion.description.length > 50 ? '...' : ''),
    description: breakRegion.description,
    status: IssueStatus.OPEN,
    priority: priorityMap[breakRegion.severity],
    severity: breakRegion.severity,
    assignee: null,
    reporter,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    dueDate: null,
    resolvedAt: null,
    closedAt: null,
    reviewResult: null,
    reviewComment: '',
    reviewer: null,
    reviewedAt: null,
    comments: [],
    tags: [],
    leftPageIndex: leftPageIndex ?? null,
    rightPageIndex: rightPageIndex ?? null
  }
}

export function createIssuesFromBreaks(
  breaksMap: Map<string, BreakRegion[]>,
  bookId: string,
  reporter: string,
  bookSpreads: BookSpread[] = []
): Issue[] {
  const issues: Issue[] = []

  for (const [spreadId, breaks] of breaksMap) {
    const bookSpread = bookSpreads.find((bs) => bs.spreadId === spreadId)
    for (const br of breaks) {
      const issue = createIssueFromBreak(
        br,
        bookId,
        spreadId,
        reporter,
        bookSpread?.leftPageIndex,
        bookSpread?.rightPageIndex
      )
      issues.push(issue)
    }
  }

  return issues
}

export function assignIssue(
  issue: Issue,
  assignee: string,
  dueDate?: number
): Issue {
  return {
    ...issue,
    assignee,
    status: IssueStatus.ASSIGNED,
    dueDate: dueDate || issue.dueDate,
    updatedAt: Date.now()
  }
}

export function updateIssueStatus(
  issue: Issue,
  status: IssueStatus,
  _operator: string
): Issue {
  const now = Date.now()
  const updates: Partial<Issue> = {
    status,
    updatedAt: now
  }

  if (status === IssueStatus.RESOLVED) {
    updates.resolvedAt = now
  }
  if (status === IssueStatus.CLOSED) {
    updates.closedAt = now
  }

  return { ...issue, ...updates }
}

export function reviewIssue(
  issue: Issue,
  reviewer: string,
  result: ReviewResult,
  comment: string = ''
): Issue {
  const now = Date.now()
  let newStatus = issue.status

  if (result === ReviewResult.APPROVED) {
    newStatus = IssueStatus.CLOSED
  } else if (
    result === ReviewResult.REJECTED ||
    result === ReviewResult.NEEDS_REVISION
  ) {
    newStatus = IssueStatus.IN_PROGRESS
  }

  return {
    ...issue,
    reviewResult: result,
    reviewComment: comment,
    reviewer,
    reviewedAt: now,
    status: newStatus,
    updatedAt: now,
    closedAt: result === ReviewResult.APPROVED ? now : issue.closedAt
  }
}

export function createIssueComment(
  issueId: string,
  author: string,
  content: string
): IssueComment {
  return {
    id: uuidv4(),
    issueId,
    author,
    content,
    createdAt: Date.now(),
    attachments: []
  }
}

export function filterIssues(issues: Issue[], filter: IssueFilter): Issue[] {
  return issues.filter((issue) => {
    if (filter.status && filter.status.length > 0) {
      if (!filter.status.includes(issue.status)) return false
    }
    if (filter.priority && filter.priority.length > 0) {
      if (!filter.priority.includes(issue.priority)) return false
    }
    if (filter.severity && filter.severity.length > 0) {
      if (!filter.severity.includes(issue.severity)) return false
    }
    if (filter.assignee !== undefined) {
      if (issue.assignee !== filter.assignee) return false
    }
    if (filter.breakType && filter.breakType.length > 0) {
      if (!issue.breakType || !filter.breakType.includes(issue.breakType)) return false
    }
    if (filter.keyword) {
      const keyword = filter.keyword.toLowerCase()
      if (
        !issue.title.toLowerCase().includes(keyword) &&
        !issue.description.toLowerCase().includes(keyword)
      ) {
        return false
      }
    }
    if (filter.dueDateFrom && issue.dueDate) {
      if (issue.dueDate < filter.dueDateFrom) return false
    }
    if (filter.dueDateTo && issue.dueDate) {
      if (issue.dueDate > filter.dueDateTo) return false
    }
    return true
  })
}
