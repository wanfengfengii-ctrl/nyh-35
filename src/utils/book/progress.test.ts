import { describe, it, expect } from 'vitest'
import type { Book, BookSpread, Issue } from '@/types'
import {
  BookStatus,
  ProofreadingStatus,
  IssueStatus,
  IssuePriority
} from '@/types'
import { calculateBookProgress } from '@/utils/book/progress'
import { v4 as uuidv4 } from 'uuid'

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: uuidv4(),
    name: '测试书籍',
    author: '测试员',
    description: '',
    totalPages: 10,
    status: BookStatus.IN_PROGRESS,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  }
}

function makeBookSpread(overrides: Partial<BookSpread> = {}): BookSpread {
  return {
    id: uuidv4(),
    bookId: 'book-1',
    spreadId: uuidv4(),
    leftPageIndex: 0,
    rightPageIndex: 1,
    sequence: 1,
    alignmentConfidence: 0,
    breakCount: 0,
    resolvedBreakCount: 0,
    proofreadingStatus: ProofreadingStatus.NOT_STARTED,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  }
}

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: uuidv4(),
    bookId: 'book-1',
    spreadId: uuidv4(),
    breakId: uuidv4(),
    breakType: 'alignment',
    title: '测试问题',
    description: '测试描述',
    status: IssueStatus.OPEN,
    priority: IssuePriority.MEDIUM,
    severity: 'medium',
    assignee: null,
    reporter: '测试员',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    dueDate: null,
    closedAt: null,
    reviewedAt: null,
    reviewer: null,
    reviewResult: null,
    reviewComment: null,
    comments: [],
    ...overrides
  }
}

describe('book/progress', () => {
  describe('calculateBookProgress', () => {
    it('空书籍应该返回 0 进度', () => {
      const book = makeBook({ totalPages: 0 })
      const progress = calculateBookProgress(book, [], [])

      expect(progress.totalSpreads).toBe(0)
      expect(progress.completedSpreads).toBe(0)
      expect(progress.progressPercentage).toBe(0)
      expect(progress.overallProgress).toBe(0)
      expect(progress.totalIssues).toBe(0)
    })

    it('全部跨页完成时进度应为 100%', () => {
      const book = makeBook()
      const spreads = [
        makeBookSpread({ sequence: 1, proofreadingStatus: ProofreadingStatus.FINALIZED }),
        makeBookSpread({ sequence: 2, proofreadingStatus: ProofreadingStatus.FINALIZED }),
        makeBookSpread({ sequence: 3, proofreadingStatus: ProofreadingStatus.FINALIZED })
      ]

      const progress = calculateBookProgress(book, spreads, [])

      expect(progress.progressPercentage).toBe(100)
      expect(progress.overallProgress).toBe(100)
      expect(progress.completedSpreads).toBe(3)
      expect(progress.pendingSpreads).toBe(0)
    })

    it('完成 2/4 时进度应为 50%', () => {
      const book = makeBook()
      const spreads = [
        makeBookSpread({ sequence: 1, proofreadingStatus: ProofreadingStatus.FINALIZED }),
        makeBookSpread({ sequence: 2, proofreadingStatus: ProofreadingStatus.FINALIZED }),
        makeBookSpread({ sequence: 3, proofreadingStatus: ProofreadingStatus.NOT_STARTED }),
        makeBookSpread({ sequence: 4, proofreadingStatus: ProofreadingStatus.IN_PROGRESS })
      ]

      const progress = calculateBookProgress(book, spreads, [])

      expect(progress.progressPercentage).toBe(50)
      expect(progress.overallProgress).toBe(50)
      expect(progress.inProgressSpreads).toBe(1)
      expect(progress.pendingSpreads).toBe(1)
    })

    it('应该正确统计问题数量', () => {
      const book = makeBook()
      const spreads = [makeBookSpread({ alignmentConfidence: 95, proofreadingStatus: ProofreadingStatus.FINALIZED })]
      const issues = [
        makeIssue({ status: IssueStatus.OPEN, priority: IssuePriority.LOW }),
        makeIssue({ status: IssueStatus.OPEN, priority: IssuePriority.HIGH }),
        makeIssue({ status: IssueStatus.RESOLVED, priority: IssuePriority.MEDIUM }),
        makeIssue({ status: IssueStatus.CLOSED, priority: IssuePriority.URGENT })
      ]

      const progress = calculateBookProgress(book, spreads, issues)

      expect(progress.totalIssues).toBe(4)
      expect(progress.openIssues).toBe(2)
      expect(progress.resolvedIssues).toBe(2)
      expect(progress.closedIssues).toBe(1)
      expect(progress.highPriorityIssues).toBe(2)
      expect(progress.alignmentAverageConfidence).toBe(95)
    })

    it('应该正确计算平均对齐置信度', () => {
      const book = makeBook()
      const spreads = [
        makeBookSpread({ alignmentConfidence: 80 }),
        makeBookSpread({ alignmentConfidence: 90 }),
        makeBookSpread({ alignmentConfidence: 0 })
      ]

      const progress = calculateBookProgress(book, spreads, [])

      expect(progress.alignmentAverageConfidence).toBe(85)
    })
  })
})
