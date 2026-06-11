import { describe, it, expect } from 'vitest'
import type { BreakRegion, BookSpread, Issue, IssueFilter } from '@/types'
import {
  IssueStatus,
  IssuePriority,
  ReviewResult
} from '@/types'
import {
  createIssueFromBreak,
  createIssuesFromBreaks,
  assignIssue,
  updateIssueStatus,
  reviewIssue,
  createIssueComment,
  filterIssues
} from '@/utils/issue/workflow'
import { v4 as uuidv4 } from 'uuid'

function makeBreak(overrides: Partial<BreakRegion> = {}): BreakRegion {
  return {
    id: uuidv4(),
    breakType: 'alignment',
    description: '对齐问题',
    severity: 'medium',
    leftPageIndex: 0,
    rightPageIndex: 1,
    x: 100,
    y: 200,
    width: 50,
    height: 50,
    resolved: false,
    reviewed: false,
    createdAt: Date.now(),
    ...overrides
  }
}

describe('issue/workflow', () => {
  describe('createIssueFromBreak', () => {
    it('应该根据断裂区域正确创建问题', () => {
      const brk = makeBreak({
        breakType: 'alignment',
        description: '严重的跨页对齐偏移超过阈值',
        severity: 'high'
      })

      const issue = createIssueFromBreak(brk, 'book-1', 'spread-1', '测试员', 0, 1)

      expect(issue.bookId).toBe('book-1')
      expect(issue.spreadId).toBe('spread-1')
      expect(issue.breakId).toBe(brk.id)
      expect(issue.breakType).toBe('alignment')
      expect(issue.title.length).toBeGreaterThan(0)
      expect(issue.description).toContain('对齐偏移')
      expect(issue.status).toBe(IssueStatus.OPEN)
      expect(issue.priority).toBe(IssuePriority.HIGH)
      expect(issue.severity).toBe('high')
      expect(issue.reporter).toBe('测试员')
      expect(issue.assignee).toBeNull()
    })

    it('高严重度 -> HIGH 优先级', () => {
      const brk = makeBreak({ severity: 'high' })
      const issue = createIssueFromBreak(brk, 'b', 's', 'r')
      expect(issue.priority).toBe(IssuePriority.HIGH)
    })

    it('中严重度 -> MEDIUM 优先级', () => {
      const brk = makeBreak({ severity: 'medium' })
      const issue = createIssueFromBreak(brk, 'b', 's', 'r')
      expect(issue.priority).toBe(IssuePriority.MEDIUM)
    })
  })

  describe('assignIssue', () => {
    it('应该正确分配问题给处理人', () => {
      const issue = { id: 'iss-1', status: IssueStatus.OPEN, updatedAt: 0 } as Issue
      const result = assignIssue(issue, '张三')

      expect(result.assignee).toBe('张三')
      expect(result.status).toBe(IssueStatus.ASSIGNED)
      expect(result.updatedAt).toBeGreaterThan(0)
    })

    it('原对象不应该被修改（不可变更新）', () => {
      const issue = {
        id: 'iss-1',
        status: IssueStatus.OPEN,
        assignee: null,
        updatedAt: 123
      } as Issue
      const result = assignIssue(issue, '李四')

      expect(issue.assignee).toBeNull()
      expect(issue.updatedAt).toBe(123)
      expect(result.assignee).toBe('李四')
    })
  })

  describe('updateIssueStatus', () => {
    it('应该更新状态和时间戳', () => {
      const issue = { id: 'i1', status: IssueStatus.OPEN, updatedAt: 0 } as Issue
      const result = updateIssueStatus(issue, IssueStatus.RESOLVED)

      expect(result.status).toBe(IssueStatus.RESOLVED)
      expect(result.updatedAt).toBeGreaterThan(0)
    })

    it('关闭时应该设置 closedAt', () => {
      const issue = {
        id: 'i1',
        status: IssueStatus.IN_PROGRESS,
        closedAt: null,
        updatedAt: 0
      } as Issue
      const result = updateIssueStatus(issue, IssueStatus.CLOSED)

      expect(result.status).toBe(IssueStatus.CLOSED)
      expect(result.closedAt).not.toBeNull()
    })
  })

  describe('reviewIssue', () => {
    it('APPROVED 时应该关闭问题', () => {
      const issue = { id: 'i1', status: IssueStatus.IN_PROGRESS, updatedAt: 0 } as Issue
      const result = reviewIssue(issue, '复核人', ReviewResult.APPROVED, '通过')

      expect(result.reviewResult).toBe(ReviewResult.APPROVED)
      expect(result.reviewer).toBe('复核人')
      expect(result.status).toBe(IssueStatus.CLOSED)
      expect(result.reviewComment).toBe('通过')
    })

    it('REJECTED 时应该回到处理中', () => {
      const issue = { id: 'i1', status: IssueStatus.IN_PROGRESS, updatedAt: 0 } as Issue
      const result = reviewIssue(issue, '复核人', ReviewResult.REJECTED, '需要修改')

      expect(result.status).toBe(IssueStatus.IN_PROGRESS)
      expect(result.reviewResult).toBe(ReviewResult.REJECTED)
      expect(result.closedAt).toBe((issue as any).closedAt)
    })
  })

  describe('createIssueComment', () => {
    it('应该创建评论对象', () => {
      const comment = createIssueComment('issue-1', '张三', '这个问题需要重新检查')

      expect(comment.issueId).toBe('issue-1')
      expect(comment.author).toBe('张三')
      expect(comment.content).toBe('这个问题需要重新检查')
      expect(comment.attachments).toEqual([])
      expect(typeof comment.id).toBe('string')
      expect(comment.createdAt).toBeGreaterThan(0)
    })
  })

  describe('filterIssues', () => {
    const issues: Issue[] = [
      { id: 'i1', status: IssueStatus.OPEN, priority: IssuePriority.HIGH, assignee: '张三', breakType: 'alignment', title: '', description: '' } as Issue,
      { id: 'i2', status: IssueStatus.IN_PROGRESS, priority: IssuePriority.MEDIUM, assignee: '李四', breakType: 'content_missing', title: '', description: '' } as Issue,
      { id: 'i3', status: IssueStatus.RESOLVED, priority: IssuePriority.LOW, assignee: '张三', breakType: 'alignment', title: '', description: '' } as Issue,
      { id: 'i4', status: IssueStatus.CLOSED, priority: IssuePriority.URGENT, assignee: '王五', breakType: 'page_order', title: '', description: '' } as Issue
    ]

    it('按状态过滤', () => {
      const filter: IssueFilter = { status: [IssueStatus.OPEN] }
      const result = filterIssues(issues, filter)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('i1')
    })

    it('按处理人过滤', () => {
      const filter: IssueFilter = { assignee: '张三' }
      const result = filterIssues(issues, filter)
      expect(result).toHaveLength(2)
    })

    it('按优先级过滤', () => {
      const filter: IssueFilter = { priority: [IssuePriority.HIGH, IssuePriority.URGENT] }
      const result = filterIssues(issues, filter)
      expect(result).toHaveLength(2)
    })

    it('按问题类型过滤', () => {
      const filter: IssueFilter = { breakType: ['alignment'] }
      const result = filterIssues(issues, filter)
      expect(result).toHaveLength(2)
    })

    it('组合过滤条件', () => {
      const filter: IssueFilter = {
        status: [IssueStatus.OPEN, IssueStatus.IN_PROGRESS],
        assignee: '张三'
      }
      const result = filterIssues(issues, filter)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('i1')
    })

    it('空过滤器返回所有问题', () => {
      const result = filterIssues(issues, {})
      expect(result).toHaveLength(4)
    })

    it('无匹配返回空数组', () => {
      const filter: IssueFilter = { assignee: '不存在的人' }
      const result = filterIssues(issues, filter)
      expect(result).toHaveLength(0)
    })
  })
})
