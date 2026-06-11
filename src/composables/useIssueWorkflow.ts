import { ref } from 'vue'
import type { Issue, IssueStatus, ReviewResult, IssuePriority } from '@/types'
import { useIssueStore } from '@/stores/issue'
import { useAppStore } from '@/stores/app'
import { useNotify } from '@/utils/common'

export function useIssueWorkflow() {
  const issueStore = useIssueStore()
  const appStore = useAppStore()
  const notify = useNotify()

  const showAssignModal = ref(false)
  const showReviewModal = ref(false)
  const showDetailModal = ref(false)
  const selectedIssue = ref<Issue | null>(null)
  const assignAssignee = ref('')
  const assignDueDate = ref<number | null>(null)
  const reviewResult = ref<ReviewResult>('approved' as ReviewResult)
  const reviewComment = ref('')
  const newComment = ref('')
  const selectedIssueIds = ref<string[]>([])

  function openIssueDetail(issue: Issue): void {
    selectedIssue.value = issue
    issueStore.selectIssue(issue.id)
    showDetailModal.value = true
  }

  function openAssignModal(issue?: Issue): void {
    if (issue) {
      selectedIssue.value = issue
      assignAssignee.value = issue.assignee || ''
      assignDueDate.value = issue.dueDate
    }
    showAssignModal.value = true
  }

  function openReviewModal(issue: Issue): void {
    selectedIssue.value = issue
    showReviewModal.value = true
  }

  function closeAssignModal(): void {
    showAssignModal.value = false
  }

  function closeReviewModal(): void {
    showReviewModal.value = false
  }

  function closeDetailModal(): void {
    showDetailModal.value = false
  }

  function handleAssign(): void {
    if (!selectedIssue.value || !assignAssignee.value.trim()) {
      notify.warning('请输入责任人')
      return
    }
    const dueDate = assignDueDate.value ? new Date(assignDueDate.value).getTime() : undefined
    const result = issueStore.assignIssueToUser(
      selectedIssue.value.id,
      assignAssignee.value.trim(),
      dueDate
    )
    if (result.success) {
      notify.success(result.message)
      showAssignModal.value = false
    } else {
      notify.warning(result.message)
    }
  }

  function handleBatchAssign(): void {
    if (selectedIssueIds.value.length === 0) {
      notify.warning('请先选择问题')
      return
    }
    if (!assignAssignee.value.trim()) {
      notify.warning('请输入责任人')
      return
    }
    const result = issueStore.batchAssignIssues(
      selectedIssueIds.value,
      assignAssignee.value.trim(),
      assignDueDate.value || undefined
    )
    if (result.success) {
      notify.success(result.message)
      selectedIssueIds.value = []
      showAssignModal.value = false
    }
  }

  function handleStartProgress(issueId: string): void {
    const result = issueStore.updateIssueState(
      issueId,
      'in_progress' as IssueStatus,
      appStore.currentAuthor
    )
    if (result.success) {
      notify.success('已开始处理')
    }
  }

  function handleSubmitReview(issueId: string): void {
    const result = issueStore.updateIssueState(
      issueId,
      'pending_review' as IssueStatus,
      appStore.currentAuthor
    )
    if (result.success) {
      notify.success('已提交复核')
    }
  }

  function handleReview(): void {
    if (!selectedIssue.value) return
    const result = issueStore.reviewIssueResult(
      selectedIssue.value.id,
      reviewResult.value,
      reviewComment.value,
      appStore.currentAuthor
    )
    if (result.success) {
      notify.success('复核完成')
      showReviewModal.value = false
    }
  }

  function handleAddComment(): void {
    if (!selectedIssue.value || !newComment.value.trim()) return
    const result = issueStore.addIssueComment(
      selectedIssue.value.id,
      newComment.value.trim(),
      appStore.currentAuthor
    )
    if (result.success) {
      newComment.value = ''
      notify.success('评论已添加')
    }
  }

  function handleUpdatePriority(issueId: string, priority: IssuePriority): void {
    const result = issueStore.updateIssuePriority(issueId, priority)
    if (result.success) {
      notify.success('优先级已更新')
    }
  }

  function handleUpdateDueDate(issueId: string, dueDate: number | null): void {
    const result = issueStore.updateIssueDueDate(issueId, dueDate)
    if (result.success) {
      notify.success('截止时间已更新')
    }
  }

  function handleRowSelectionChange(keys: string[]): void {
    selectedIssueIds.value = keys
  }

  return {
    showAssignModal,
    showReviewModal,
    showDetailModal,
    selectedIssue,
    assignAssignee,
    assignDueDate,
    reviewResult,
    reviewComment,
    newComment,
    selectedIssueIds,
    openIssueDetail,
    openAssignModal,
    openReviewModal,
    closeAssignModal,
    closeReviewModal,
    closeDetailModal,
    handleAssign,
    handleBatchAssign,
    handleStartProgress,
    handleSubmitReview,
    handleReview,
    handleAddComment,
    handleUpdatePriority,
    handleUpdateDueDate,
    handleRowSelectionChange
  }
}
