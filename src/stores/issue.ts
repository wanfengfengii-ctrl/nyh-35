import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import {
  Issue,
  IssueStatus,
  IssueFilter,
  IssuePriority,
  IssueComment,
  ReviewResult,
  BreakRegion,
  BookSpread
} from '@/types'
import {
  filterIssues,
  assignIssue,
  updateIssueStatus,
  reviewIssue,
  createIssuesFromBreaks
} from '@/utils/batchProcessing'

export const useIssueStore = defineStore('issue', () => {
  const issues = ref<Issue[]>([])
  const currentIssueId = ref<string | null>(null)
  const issueFilter = ref<IssueFilter>({})

  const currentIssue = computed<Issue | null>(() => {
    if (!currentIssueId.value) return null
    return issues.value.find((i) => i.id === currentIssueId.value) || null
  })

  const filteredIssues = computed<Issue[]>(() => {
    return filterIssues(issues.value, issueFilter.value)
  })

  function getIssuesByBook(bookId: string): Issue[] {
    return issues.value.filter((i) => i.bookId === bookId)
  }

  function createIssuesFromBreaksMap(
    breaksMap: Map<string, BreakRegion[]>,
    bookId: string,
    reporter: string,
    bookSpreads: BookSpread[] = []
  ): Issue[] {
    const newIssues = createIssuesFromBreaks(breaksMap, bookId, reporter, bookSpreads)
    for (const issue of newIssues) {
      issues.value.push(issue)
    }
    return newIssues
  }

  function assignIssueToUser(
    issueId: string,
    assignee: string,
    dueDate?: number
  ): { success: boolean; message: string } {
    const issue = issues.value.find((i) => i.id === issueId)
    if (!issue) {
      return { success: false, message: '问题不存在' }
    }
    const idx = issues.value.findIndex((i) => i.id === issueId)
    issues.value[idx] = assignIssue(issue, assignee, dueDate)
    return { success: true, message: '分配成功' }
  }

  function batchAssignIssues(
    issueIds: string[],
    assignee: string,
    dueDate?: number
  ): { success: boolean; assigned: number; message: string } {
    let assigned = 0
    for (const id of issueIds) {
      const result = assignIssueToUser(id, assignee, dueDate)
      if (result.success) assigned++
    }
    return {
      success: assigned > 0,
      assigned,
      message: `成功分配 ${assigned} 个问题给 ${assignee}`
    }
  }

  function updateIssueState(
    issueId: string,
    status: IssueStatus,
    operator: string = '整理员'
  ): { success: boolean; message: string } {
    const issue = issues.value.find((i) => i.id === issueId)
    if (!issue) {
      return { success: false, message: '问题不存在' }
    }
    const idx = issues.value.findIndex((i) => i.id === issueId)
    issues.value[idx] = updateIssueStatus(issue, status, operator)
    return { success: true, message: '状态已更新' }
  }

  function reviewIssueResult(
    issueId: string,
    result: ReviewResult,
    comment: string = '',
    reviewer: string = '整理员'
  ): { success: boolean; message: string } {
    const issue = issues.value.find((i) => i.id === issueId)
    if (!issue) {
      return { success: false, message: '问题不存在' }
    }
    const idx = issues.value.findIndex((i) => i.id === issueId)
    issues.value[idx] = reviewIssue(issue, reviewer, result, comment)
    return { success: true, message: '复核完成' }
  }

  function addIssueComment(
    issueId: string,
    content: string,
    author: string = '整理员'
  ): { success: boolean; message: string } {
    const issue = issues.value.find((i) => i.id === issueId)
    if (!issue) {
      return { success: false, message: '问题不存在' }
    }
    const comment: IssueComment = {
      id: uuidv4(),
      issueId,
      author,
      content,
      createdAt: Date.now(),
      attachments: []
    }
    issue.comments.push(comment)
    issue.updatedAt = Date.now()
    return { success: true, message: '评论已添加' }
  }

  function setIssueFilter(filter: IssueFilter): void {
    issueFilter.value = filter
  }

  function selectIssue(issueId: string | null): void {
    currentIssueId.value = issueId
  }

  function updateIssueDueDate(
    issueId: string,
    dueDate: number | null
  ): { success: boolean; message: string } {
    const issue = issues.value.find((i) => i.id === issueId)
    if (!issue) {
      return { success: false, message: '问题不存在' }
    }
    issue.dueDate = dueDate
    issue.updatedAt = Date.now()
    return { success: true, message: '截止时间已更新' }
  }

  function updateIssuePriority(
    issueId: string,
    priority: IssuePriority
  ): { success: boolean; message: string } {
    const issue = issues.value.find((i) => i.id === issueId)
    if (!issue) {
      return { success: false, message: '问题不存在' }
    }
    issue.priority = priority
    issue.updatedAt = Date.now()
    return { success: true, message: '优先级已更新' }
  }

  function removeIssuesByBook(bookId: string): void {
    issues.value = issues.value.filter((i) => i.bookId !== bookId)
  }

  function clearIssueData(): void {
    issues.value = []
    currentIssueId.value = null
    issueFilter.value = {}
  }

  return {
    issues,
    currentIssueId,
    issueFilter,
    currentIssue,
    filteredIssues,
    getIssuesByBook,
    createIssuesFromBreaksMap,
    assignIssueToUser,
    batchAssignIssues,
    updateIssueState,
    reviewIssueResult,
    addIssueComment,
    setIssueFilter,
    selectIssue,
    updateIssueDueDate,
    updateIssuePriority,
    removeIssuesByBook,
    clearIssueData
  }
})
