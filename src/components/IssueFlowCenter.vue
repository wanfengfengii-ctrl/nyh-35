<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useMainStore } from '@/stores/main'
import {
  NButton,
  NCard,
  NSpace,
  NInput,
  NSelect,
  NTag,
  NText,
  NEmpty,
  NModal,
  NForm,
  NFormItem,
  NDivider,
  NAlert,
  NBadge,
  NRadio,
  NRadioGroup,
  NPopconfirm,
  NIcon,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NList,
  NListItem,
  NTabs,
  NTabPane,
  type DataTableColumns,
  type SelectOption
} from 'naive-ui'
import {
  Issue,
  IssueStatus,
  IssueStatusLabel,
  IssuePriority,
  IssuePriorityLabel,
  BreakSeverity,
  BreakSeverityLabel,
  BreakType,
  BreakTypeLabel,
  ReviewResult,
  ReviewResultLabel,
  ReviewResult as ReviewResultEnum,
  type IssueComment
} from '@/types'

const store = useMainStore()

const showIssueDetailModal = ref(false)
const showAssignModal = ref(false)
const showReviewModal = ref(false)
const selectedIssue = ref<Issue | null>(null)
const assignAssignee = ref('')
const assignDueDate = ref<number | null>(null)
const reviewResult = ref<ReviewResult>(ReviewResult.APPROVED)
const reviewComment = ref('')
const newComment = ref('')

const statusFilter = ref<IssueStatus[]>([])
const priorityFilter = ref<IssuePriority[]>([])
const severityFilter = ref<BreakSeverity[]>([])
const keywordFilter = ref('')
const assigneeFilter = ref<string | null>(null)

const selectedIssueIds = ref<string[]>([])

const statusOptions: SelectOption[] = Object.entries(IssueStatusLabel).map(
  ([value, label]) => ({ label, value })
)

const priorityOptions: SelectOption[] = Object.entries(IssuePriorityLabel).map(
  ([value, label]) => ({ label, value })
)

const severityOptions: SelectOption[] = Object.entries(BreakSeverityLabel).map(
  ([value, label]) => ({ label, value })
)

const breakTypeOptions: SelectOption[] = Object.entries(BreakTypeLabel).map(
  ([value, label]) => ({ label, value })
)

const reviewResultOptions: SelectOption[] = Object.entries(ReviewResultLabel).map(
  ([value, label]) => ({ label, value })
)

const statusTagType: Record<IssueStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  [IssueStatus.OPEN]: 'default',
  [IssueStatus.ASSIGNED]: 'info',
  [IssueStatus.IN_PROGRESS]: 'warning',
  [IssueStatus.PENDING_REVIEW]: 'warning',
  [IssueStatus.RESOLVED]: 'success',
  [IssueStatus.CLOSED]: 'success'
}

const priorityTagType: Record<IssuePriority, 'default' | 'info' | 'warning' | 'error'> = {
  [IssuePriority.LOW]: 'default',
  [IssuePriority.MEDIUM]: 'info',
  [IssuePriority.HIGH]: 'warning',
  [IssuePriority.URGENT]: 'error'
}

const severityTagType: Record<BreakSeverity, 'default' | 'warning' | 'error'> = {
  [BreakSeverity.LOW]: 'default',
  [BreakSeverity.MEDIUM]: 'warning',
  [BreakSeverity.HIGH]: 'error'
}

const issueColumns: DataTableColumns<Issue> = [
  {
    type: 'selection',
    width: 40
  },
  {
    title: '标题',
    key: 'title',
    ellipsis: { tooltip: true },
    width: 200
  },
  {
    title: '类型',
    key: 'breakType',
    width: 100,
    render: (row) =>
      row.breakType
        ? BreakTypeLabel[row.breakType]
        : '其他'
  },
  {
    title: '优先级',
    key: 'priority',
    width: 80,
    render: (row) =>
      h(
        NTag,
        { type: priorityTagType[row.priority], size: 'small' },
        { default: () => IssuePriorityLabel[row.priority] }
      )
  },
  {
    title: '严重度',
    key: 'severity',
    width: 80,
    render: (row) =>
      h(
        NTag,
        { type: severityTagType[row.severity], size: 'small' },
        { default: () => BreakSeverityLabel[row.severity] }
      )
  },
  {
    title: '状态',
    key: 'status',
    width: 90,
    render: (row) =>
      h(
        NTag,
        { type: statusTagType[row.status], size: 'small' },
        { default: () => IssueStatusLabel[row.status] }
      )
  },
  {
    title: '责任人',
    key: 'assignee',
    width: 80,
    render: (row) => row.assignee || '未分配'
  },
  {
    title: '截止时间',
    key: 'dueDate',
    width: 120,
    render: (row) => {
      if (!row.dueDate) return '未设置'
      const isOverdue = row.dueDate < Date.now() && row.status !== IssueStatus.CLOSED
      return h(
        NTag,
        { type: isOverdue ? 'error' : 'default', size: 'small' },
        { default: () => formatDate(row.dueDate) }
      )
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    render: (row) =>
      h(
        NSpace,
        { size: 'small' },
        {
          default: () => [
            h(
              NButton,
              {
                size: 'tiny',
                type: 'primary',
                onClick: () => openIssueDetail(row)
              },
              { default: () => '详情' }
            ),
            h(
              NButton,
              {
                size: 'tiny',
                onClick: () => openAssignModal(row)
              },
              { default: () => '分配' }
            ),
            row.status === IssueStatus.ASSIGNED
              ? h(
                  NButton,
                  {
                    size: 'tiny',
                    type: 'warning',
                    onClick: () => handleStartProgress(row.id)
                  },
                  { default: () => '开始处理' }
                )
              : null,
            row.status === IssueStatus.IN_PROGRESS
              ? h(
                  NButton,
                  {
                    size: 'tiny',
                    type: 'success',
                    onClick: () => handleSubmitReview(row.id)
                  },
                  { default: () => '提交复核' }
                )
              : null,
            row.status === IssueStatus.PENDING_REVIEW
              ? h(
                  NButton,
                  {
                    size: 'tiny',
                    type: 'primary',
                    onClick: () => openReviewModal(row)
                  },
                  { default: () => '复核' }
                )
              : null
          ].filter(Boolean)
        }
      )
  }
]

const statsCards = computed(() => [
  {
    title: '全部问题',
    value: store.currentBookIssues.length,
    type: 'default' as const
  },
  {
    title: '待分配',
    value: store.currentBookIssues.filter((i) => i.status === IssueStatus.OPEN).length,
    type: 'info' as const
  },
  {
    title: '处理中',
    value: store.currentBookIssues.filter(
      (i) => i.status === IssueStatus.IN_PROGRESS || i.status === IssueStatus.ASSIGNED
    ).length,
    type: 'warning' as const
  },
  {
    title: '已解决',
    value: store.currentBookIssues.filter(
      (i) => i.status === IssueStatus.RESOLVED || i.status === IssueStatus.CLOSED
    ).length,
    type: 'success' as const
  },
  {
    title: '高优先级',
    value: store.currentBookIssues.filter(
      (i) => i.priority === IssuePriority.HIGH || i.priority === IssuePriority.URGENT
    ).length,
    type: 'error' as const
  }
])

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function applyFilters() {
  store.setIssueFilter({
    status: statusFilter.value.length > 0 ? statusFilter.value : undefined,
    priority: priorityFilter.value.length > 0 ? priorityFilter.value : undefined,
    severity: severityFilter.value.length > 0 ? severityFilter.value : undefined,
    assignee: assigneeFilter.value !== undefined ? assigneeFilter.value : undefined,
    keyword: keywordFilter.value || undefined
  })
}

function resetFilters() {
  statusFilter.value = []
  priorityFilter.value = []
  severityFilter.value = []
  keywordFilter.value = ''
  assigneeFilter.value = null
  store.setIssueFilter({})
}

function openIssueDetail(issue: Issue) {
  selectedIssue.value = issue
  store.selectIssue(issue.id)
  showIssueDetailModal.value = true
}

function openAssignModal(issue: Issue) {
  selectedIssue.value = issue
  assignAssignee.value = issue.assignee || ''
  assignDueDate.value = issue.dueDate
  showAssignModal.value = true
}

function openReviewModal(issue: Issue) {
  selectedIssue.value = issue
  reviewResult.value = ReviewResult.APPROVED
  reviewComment.value = ''
  showReviewModal.value = true
}

function handleAssign() {
  if (!selectedIssue.value || !assignAssignee.value.trim()) {
    window.$message?.warning('请输入责任人')
    return
  }
  const dueDate = assignDueDate.value ? new Date(assignDueDate.value).getTime() : undefined
  const result = store.assignIssueToUser(
    selectedIssue.value.id,
    assignAssignee.value.trim(),
    dueDate
  )
  if (result.success) {
    window.$message?.success(result.message)
    showAssignModal.value = false
  } else {
    window.$message?.warning(result.message)
  }
}

function handleStartProgress(issueId: string) {
  const result = store.updateIssueState(issueId, IssueStatus.IN_PROGRESS)
  if (result.success) {
    window.$message?.success('已开始处理')
  }
}

function handleSubmitReview(issueId: string) {
  const result = store.updateIssueState(issueId, IssueStatus.PENDING_REVIEW)
  if (result.success) {
    window.$message?.success('已提交复核')
  }
}

function handleReview() {
  if (!selectedIssue.value) return
  const result = store.reviewIssueResult(
    selectedIssue.value.id,
    reviewResult.value,
    reviewComment.value
  )
  if (result.success) {
    window.$message?.success('复核完成')
    showReviewModal.value = false
  }
}

function handleAddComment() {
  if (!selectedIssue.value || !newComment.value.trim()) return
  const result = store.addIssueComment(selectedIssue.value.id, newComment.value.trim())
  if (result.success) {
    newComment.value = ''
    window.$message?.success('评论已添加')
  }
}

function handleBatchAssign() {
  if (selectedIssueIds.value.length === 0) {
    window.$message?.warning('请先选择问题')
    return
  }
  if (!assignAssignee.value.trim()) {
    window.$message?.warning('请输入责任人')
    return
  }
  const result = store.batchAssignIssues(
    selectedIssueIds.value,
    assignAssignee.value.trim(),
    assignDueDate.value || undefined
  )
  if (result.success) {
    window.$message?.success(result.message)
    selectedIssueIds.value = []
  }
}

function handleRowSelectionChange(keys: string[]) {
  selectedIssueIds.value = keys
}

function handleUpdatePriority(issueId: string, priority: IssuePriority) {
  const result = store.updateIssuePriority(issueId, priority)
  if (result.success) {
    window.$message?.success('优先级已更新')
  }
}

function handleUpdateDueDate(issueId: string, dueDate: number | null) {
  const result = store.updateIssueDueDate(issueId, dueDate)
  if (result.success) {
    window.$message?.success('截止时间已更新')
  }
}
</script>

<template>
  <div style="padding: 8px; overflow-y: auto; max-height: calc(100vh - 180px)">
    <NSpace vertical style="width: 100%">
      <NCard size="small" title="🔄 问题流转中心">
        <NSpace vertical style="width: 100%">
          <NSpace wrap>
            <NTag v-for="stat in statsCards" :key="stat.title" :type="stat.type" size="large">
              <NText strong>{{ stat.value }}</NText>
              <NText depth="3" style="margin-left: 4px">{{ stat.title }}</NText>
            </NTag>
          </NSpace>
        </NSpace>
      </NCard>

      <NCard size="small" title="🔍 筛选条件">
        <NSpace vertical style="width: 100%">
          <NSpace wrap>
            <NInput
              v-model:value="keywordFilter"
              placeholder="搜索关键词..."
              style="width: 200px"
              size="small"
              clearable
              @update:value="applyFilters"
            />
            <NSelect
              v-model:value="statusFilter"
              multiple
              placeholder="状态筛选"
              :options="statusOptions"
              style="width: 160px"
              size="small"
              @update:value="applyFilters"
            />
            <NSelect
              v-model:value="priorityFilter"
              multiple
              placeholder="优先级筛选"
              :options="priorityOptions"
              style="width: 140px"
              size="small"
              @update:value="applyFilters"
            />
            <NSelect
              v-model:value="severityFilter"
              multiple
              placeholder="严重度筛选"
              :options="severityOptions"
              style="width: 140px"
              size="small"
              @update:value="applyFilters"
            />
            <NButton size="small" @click="resetFilters">重置</NButton>
          </NSpace>
        </NSpace>
      </NCard>

      <NCard size="small" title="📋 问题清单">
        <NSpace vertical style="width: 100%">
          <NSpace>
            <NButton
              size="small"
              type="primary"
              :disabled="selectedIssueIds.length === 0"
              @click="showAssignModal = true"
            >
              批量分配 ({{ selectedIssueIds.length }})
            </NButton>
          </NSpace>

          <div v-if="store.filteredIssues.length === 0">
            <NEmpty description="暂无问题数据" size="small" />
          </div>

          <NDataTable
            v-else
            :columns="issueColumns"
            :data="store.filteredIssues"
            :row-key="(r) => r.id"
            size="small"
            :max-height="500"
            :pagination="false"
            @update:checked-row-keys="handleRowSelectionChange"
          />
        </NSpace>
      </NCard>
    </NSpace>

    <NModal
      v-model:show="showIssueDetailModal"
      preset="card"
      title="问题详情"
      style="width: 680px"
    >
      <template v-if="selectedIssue">
        <NTabs type="line" size="small">
          <NTabPane name="info" tab="基本信息">
            <NSpace vertical style="width: 100%; padding: 8px 0">
              <NDescriptions label-placement="left" size="small" :column="1" bordered>
                <NDescriptionsItem label="标题">
                  {{ selectedIssue.title }}
                </NDescriptionsItem>
                <NDescriptionsItem label="描述">
                  {{ selectedIssue.description }}
                </NDescriptionsItem>
                <NDescriptionsItem label="类型">
                  {{ selectedIssue.breakType ? BreakTypeLabel[selectedIssue.breakType] : '其他' }}
                </NDescriptionsItem>
                <NDescriptionsItem label="优先级">
                  <NTag :type="priorityTagType[selectedIssue.priority]" size="small">
                    {{ IssuePriorityLabel[selectedIssue.priority] }}
                  </NTag>
                </NDescriptionsItem>
                <NDescriptionsItem label="严重度">
                  <NTag :type="severityTagType[selectedIssue.severity]" size="small">
                    {{ BreakSeverityLabel[selectedIssue.severity] }}
                  </NTag>
                </NDescriptionsItem>
                <NDescriptionsItem label="状态">
                  <NTag :type="statusTagType[selectedIssue.status]" size="small">
                    {{ IssueStatusLabel[selectedIssue.status] }}
                  </NTag>
                </NDescriptionsItem>
                <NDescriptionsItem label="报告人">
                  {{ selectedIssue.reporter }}
                </NDescriptionsItem>
                <NDescriptionsItem label="责任人">
                  {{ selectedIssue.assignee || '未分配' }}
                </NDescriptionsItem>
                <NDescriptionsItem label="创建时间">
                  {{ formatDate(selectedIssue.createdAt) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="截止时间">
                  {{ selectedIssue.dueDate ? formatDate(selectedIssue.dueDate) : '未设置' }}
                </NDescriptionsItem>
                <NDescriptionsItem v-if="selectedIssue.reviewer" label="复核人">
                  {{ selectedIssue.reviewer }}
                </NDescriptionsItem>
                <NDescriptionsItem v-if="selectedIssue.reviewResult" label="复核结果">
                  {{ ReviewResultLabel[selectedIssue.reviewResult] }}
                </NDescriptionsItem>
                <NDescriptionsItem v-if="selectedIssue.reviewComment" label="复核意见">
                  {{ selectedIssue.reviewComment }}
                </NDescriptionsItem>
              </NDescriptions>

              <NSpace v-if="selectedIssue.leftPageIndex !== null">
                <NText depth="3">
                  涉及页码：第 {{ selectedIssue.leftPageIndex + 1 }} - {{ (selectedIssue.rightPageIndex || 0) + 1 }} 页
                </NText>
              </NSpace>
            </NSpace>
          </NTabPane>

          <NTabPane name="comments" tab="评论记录">
            <NSpace vertical style="width: 100%; padding: 8px 0">
              <div v-if="selectedIssue.comments.length === 0">
                <NEmpty description="暂无评论" size="small" />
              </div>
              <NList v-else size="small" bordered>
                <NListItem v-for="comment in selectedIssue.comments" :key="comment.id">
                  <NSpace vertical style="width: 100%">
                    <NSpace justify="space-between">
                      <NText strong>{{ comment.author }}</NText>
                      <NText depth="3" style="font-size: 12px">
                        {{ formatDate(comment.createdAt) }}
                      </NText>
                    </NSpace>
                    <NText>{{ comment.content }}</NText>
                  </NSpace>
                </NListItem>
              </NList>

              <NDivider />

              <NSpace vertical style="width: 100%">
                <NInput
                  v-model:value="newComment"
                  type="textarea"
                  placeholder="添加评论..."
                  :rows="3"
                />
                <NSpace justify="end">
                  <NButton size="small" type="primary" @click="handleAddComment">
                    发表评论
                  </NButton>
                </NSpace>
              </NSpace>
            </NSpace>
          </NTabPane>
        </NTabs>
      </template>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showIssueDetailModal = false">关闭</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal
      v-model:show="showAssignModal"
      preset="card"
      title="分配问题"
      style="width: 420px"
    >
      <NForm label-placement="left" label-width="80px">
        <NFormItem label="责任人" required>
          <NInput v-model:value="assignAssignee" placeholder="请输入责任人姓名" />
        </NFormItem>
        <NFormItem label="截止时间">
          <NInput
            v-model:value="assignDueDate"
            type="datetime"
            placeholder="选择截止时间"
            clearable
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showAssignModal = false">取消</NButton>
          <NButton type="primary" @click="handleAssign">
            {{ selectedIssueIds.length > 0 ? '批量分配' : '分配' }}
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal
      v-model:show="showReviewModal"
      preset="card"
      title="复核问题"
      style="width: 480px"
    >
      <NForm label-placement="left" label-width="80px">
        <NFormItem label="复核结果">
          <NRadioGroup v-model:value="reviewResult">
            <NSpace>
              <NRadio :value="ReviewResult.APPROVED">
                {{ ReviewResultLabel[ReviewResult.APPROVED] }}
              </NRadio>
              <NRadio :value="ReviewResult.NEEDS_REVISION">
                {{ ReviewResultLabel[ReviewResult.NEEDS_REVISION] }}
              </NRadio>
              <NRadio :value="ReviewResult.REJECTED">
                {{ ReviewResultLabel[ReviewResult.REJECTED] }}
              </NRadio>
            </NSpace>
          </NRadioGroup>
        </NFormItem>
        <NFormItem label="复核意见">
          <NInput v-model:value="reviewComment" type="textarea" placeholder="请输入复核意见..." :rows="4" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showReviewModal = false">取消</NButton>
          <NButton type="primary" @click="handleReview">提交</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
