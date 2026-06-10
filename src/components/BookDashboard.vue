<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useMainStore } from '@/stores/main'
import {
  NButton,
  NCard,
  NSpace,
  NTag,
  NText,
  NEmpty,
  NProgress,
  NModal,
  NTabs,
  NTabPane,
  NDescriptions,
  NDescriptionsItem,
  NList,
  NListItem,
  NNumberAnimation,
  NDivider,
  NAlert,
  NRadio,
  NRadioGroup
} from 'naive-ui'
import {
  BookStatusLabel,
  BreakTypeLabel,
  BreakSeverityLabel,
  BreakType,
  BreakSeverity,
  IssueStatusLabel,
  IssuePriorityLabel,
  IssueStatus,
  IssuePriority,
  type BookClosureReport
} from '@/types'

const store = useMainStore()

const showReportModal = ref(false)
const currentReport = ref<BookClosureReport | null>(null)
const selectedExportFormat = ref<'text' | 'json'>('text')

const progressStats = computed(() => {
  if (!store.currentBookProgress) return null
  const progress = store.currentBookProgress
  return [
    { label: '总跨页', value: progress.totalSpreads, type: 'default' as const },
    { label: '已完成', value: progress.completedSpreads, type: 'success' as const },
    { label: '进行中', value: progress.inProgressSpreads, type: 'warning' as const },
    { label: '待处理', value: progress.pendingSpreads, type: 'info' as const }
  ]
})

const issueStats = computed(() => {
  if (!store.currentBookProgress) return null
  const progress = store.currentBookProgress
  return [
    { label: '问题总数', value: progress.totalIssues, type: 'default' as const },
    { label: '待处理', value: progress.openIssues, type: 'info' as const },
    { label: '已解决', value: progress.resolvedIssues, type: 'success' as const },
    { label: '高优先级', value: progress.highPriorityIssues, type: 'error' as const },
    { label: '已逾期', value: progress.overdueIssues, type: 'error' as const }
  ]
})

const issuesByType = computed(() => {
  const issues = store.currentBookIssues
  const result: Record<string, number> = {}
  for (const issue of issues) {
    const type = issue.breakType || 'other'
    result[type] = (result[type] || 0) + 1
  }
  return result
})

const issuesBySeverity = computed(() => {
  const issues = store.currentBookIssues
  const result: Record<string, number> = {
    [BreakSeverity.LOW]: 0,
    [BreakSeverity.MEDIUM]: 0,
    [BreakSeverity.HIGH]: 0
  }
  for (const issue of issues) {
    result[issue.severity]++
  }
  return result
})

const issuesByStatus = computed(() => {
  const issues = store.currentBookIssues
  const result: Record<string, number> = {}
  for (const issue of issues) {
    result[issue.status] = (result[issue.status] || 0) + 1
  }
  return result
})

const issuesByPriority = computed(() => {
  const issues = store.currentBookIssues
  const result: Record<string, number> = {
    [IssuePriority.LOW]: 0,
    [IssuePriority.MEDIUM]: 0,
    [IssuePriority.HIGH]: 0,
    [IssuePriority.URGENT]: 0
  }
  for (const issue of issues) {
    result[issue.priority]++
  }
  return result
})

const assigneeStats = computed(() => {
  const issues = store.currentBookIssues
  const stats: Record<string, { assigned: number; resolved: number }> = {}
  for (const issue of issues) {
    if (issue.assignee) {
      if (!stats[issue.assignee]) {
        stats[issue.assignee] = { assigned: 0, resolved: 0 }
      }
      stats[issue.assignee].assigned++
      if (
        issue.status === IssueStatus.RESOLVED ||
        issue.status === IssueStatus.CLOSED
      ) {
        stats[issue.assignee].resolved++
      }
    }
  }
  return stats
})

const resolvedRate = computed(() => {
  if (!store.currentBookProgress) return 0
  const total = store.currentBookProgress.totalIssues
  if (total === 0) return 100
  return Math.round((store.currentBookProgress.resolvedIssues / total) * 100)
})

function handleGenerateReport() {
  const report = store.generateBookReport()
  if (report) {
    currentReport.value = report
    showReportModal.value = true
  }
}

function handleExportReport() {
  if (!currentReport.value) return
  const content = store.exportBookReport(currentReport.value, selectedExportFormat.value)
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const ext = selectedExportFormat.value === 'json' ? 'json' : 'txt'
  a.download = `整册闭环报告_${currentReport.value.bookName}_${Date.now()}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
  window.$message?.success('报告已导出')
}

function getBreakTypeLabel(type: string): string {
  if (type === 'other') return '其他'
  return BreakTypeLabel[type as BreakType] || type
}

function getSeverityLabel(sev: string): string {
  return BreakSeverityLabel[sev as BreakSeverity] || sev
}

function getStatusLabel(status: string): string {
  return IssueStatusLabel[status as IssueStatus] || status
}

function getPriorityLabel(priority: string): string {
  return IssuePriorityLabel[priority as IssuePriority] || priority
}
</script>

<template>
  <div style="padding: 8px; overflow-y: auto; max-height: calc(100vh - 180px)">
    <NSpace vertical style="width: 100%">
      <template v-if="!store.currentBook">
        <NCard size="small">
          <NEmpty description="请先选择或创建整册项目" size="medium" />
        </NCard>
      </template>

      <template v-else>
        <NCard size="small" title="📊 整册进度看板">
          <NSpace vertical style="width: 100%">
            <div>
              <NSpace justify="space-between" style="margin-bottom: 8px">
                <NText strong style="font-size: 16px">{{ store.currentBook.name }}</NText>
                <NTag :type="store.currentBook.status === 'finalized' ? 'success' : 'info'" round>
                  {{ BookStatusLabel[store.currentBook.status] }}
                </NTag>
              </NSpace>
              <div v-if="store.currentBookProgress">
                <NProgress
                  :percentage="store.currentBookProgress.progressPercentage"
                  :stroke-width="12"
                  :show-indicator="false"
                />
                <NSpace justify="space-between" style="margin-top: 4px">
                  <NText depth="3">
                    进度 {{ store.currentBookProgress.progressPercentage }}%
                  </NText>
                  <NText depth="3">
                    {{ store.currentBookProgress.completedSpreads }} / {{ store.currentBookProgress.totalSpreads }} 跨页
                  </NText>
                </NSpace>
              </div>
            </div>
          </NSpace>
        </NCard>

        <NCard size="small" title="📖 跨页进度">
          <NSpace wrap style="width: 100%">
            <div
              v-for="stat in progressStats"
              :key="stat.label"
              style="min-width: 120px; flex: 1"
            >
              <NCard size="small" :bordered="false" style="text-align: center">
                <NText depth="3" style="font-size: 12px">{{ stat.label }}</NText>
                <div style="font-size: 28px; font-weight: bold; margin: 4px 0">
                  <NNumberAnimation :from="0" :to="stat.value" />
                </div>
                <NTag :type="stat.type" size="small">{{ stat.label }}</NTag>
              </NCard>
            </div>
          </NSpace>
        </NCard>

        <NCard size="small" title="🔍 问题统计">
          <NSpace wrap style="width: 100%">
            <div
              v-for="stat in issueStats"
              :key="stat.label"
              style="min-width: 120px; flex: 1"
            >
              <NCard size="small" :bordered="false" style="text-align: center">
                <NText depth="3" style="font-size: 12px">{{ stat.label }}</NText>
                <div style="font-size: 28px; font-weight: bold; margin: 4px 0">
                  <NNumberAnimation :from="0" :to="stat.value" />
                </div>
                <NTag :type="stat.type" size="small">{{ stat.label }}</NTag>
              </NCard>
            </div>
          </NSpace>

          <NDivider />

          <div>
            <NSpace justify="space-between" style="margin-bottom: 4px">
              <NText>问题解决率</NText>
              <NText strong>{{ resolvedRate }}%</NText>
            </NSpace>
            <NProgress
              :percentage="resolvedRate"
              :stroke-width="10"
              :type="resolvedRate >= 90 ? 'success' : resolvedRate >= 70 ? 'warning' : 'error'"
              :show-indicator="false"
            />
          </div>
        </NCard>

        <NCard size="small" title="📈 问题分布">
          <NSpace vertical style="width: 100%">
            <div>
              <NText strong style="margin-bottom: 8px; display: block">按类型分布</NText>
              <NSpace wrap>
                <NTag v-for="(count, type) in issuesByType" :key="type" size="large">
                  {{ getBreakTypeLabel(type as string) }}: {{ count }}
                </NTag>
              </NSpace>
            </div>

            <div>
              <NText strong style="margin-bottom: 8px; display: block">按严重度分布</NText>
              <NSpace wrap>
                <NTag v-for="(count, sev) in issuesBySeverity" :key="sev" size="large" :type="sev === 'high' ? 'error' : sev === 'medium' ? 'warning' : 'default'">
                  {{ getSeverityLabel(sev as string) }}: {{ count }}
                </NTag>
              </NSpace>
            </div>

            <div>
              <NText strong style="margin-bottom: 8px; display: block">按状态分布</NText>
              <NSpace wrap>
                <NTag v-for="(count, status) in issuesByStatus" :key="status" size="large">
                  {{ getStatusLabel(status as string) }}: {{ count }}
                </NTag>
              </NSpace>
            </div>

            <div>
              <NText strong style="margin-bottom: 8px; display: block">按优先级分布</NText>
              <NSpace wrap>
                <NTag v-for="(count, priority) in issuesByPriority" :key="priority" size="large" :type="priority === 'urgent' ? 'error' : priority === 'high' ? 'warning' : priority === 'medium' ? 'info' : 'default'">
                  {{ getPriorityLabel(priority as string) }}: {{ count }}
                </NTag>
              </NSpace>
            </div>
          </NSpace>
        </NCard>

        <NCard size="small" title="👥 人员贡献">
          <NSpace vertical style="width: 100%">
            <div v-if="Object.keys(assigneeStats).length === 0">
              <NEmpty description="暂无人员贡献数据" size="small" />
            </div>
            <NList v-else size="small" bordered>
              <NListItem v-for="(stats, name) in assigneeStats" :key="name">
                <NSpace justify="space-between" style="width: 100%">
                  <NText strong>{{ name }}</NText>
                  <NSpace>
                    <NTag size="small">分配: {{ stats.assigned }}</NTag>
                    <NTag type="success" size="small">解决: {{ stats.resolved }}</NTag>
                    <NTag type="info" size="small">
                      完成率: {{ stats.assigned > 0 ? Math.round((stats.resolved / stats.assigned) * 100) : 0 }}%
                    </NTag>
                  </NSpace>
                </NSpace>
              </NListItem>
            </NList>
          </NSpace>
        </NCard>

        <NCard size="small" title="📑 闭环报告">
          <NSpace vertical style="width: 100%">
            <NAlert v-if="store.currentBookProgress" type="info">
              当前整册进度：{{ store.currentBookProgress.progressPercentage }}%，
              共 {{ store.currentBookProgress.totalIssues }} 个问题，
              已解决 {{ store.currentBookProgress.resolvedIssues }} 个
            </NAlert>
            <NButton type="primary" @click="handleGenerateReport">
              生成整册闭环报告
            </NButton>
          </NSpace>
        </NCard>
      </template>
    </NSpace>

    <NModal
      v-model:show="showReportModal"
      preset="card"
      title="整册闭环报告"
      style="width: 720px"
    >
      <template v-if="currentReport">
        <NTabs type="line" size="small">
          <NTabPane name="overview" tab="概览">
            <NSpace vertical style="width: 100%; padding: 8px 0">
              <NAlert :type="resolvedRate >= 90 ? 'success' : resolvedRate >= 70 ? 'warning' : 'error'">
                {{ currentReport.progressSummary }}
              </NAlert>
              <NAlert type="info">
                {{ currentReport.qualityAssessment }}
              </NAlert>

              <NDescriptions label-placement="left" size="small" :column="2" bordered>
                <NDescriptionsItem label="书籍名称">
                  {{ currentReport.bookName }}
                </NDescriptionsItem>
                <NDescriptionsItem label="总页数">
                  {{ currentReport.totalPages }} 页
                </NDescriptionsItem>
                <NDescriptionsItem label="总跨页数">
                  {{ currentReport.totalSpreads }} 个
                </NDescriptionsItem>
                <NDescriptionsItem label="问题总数">
                  {{ currentReport.totalIssues }}
                </NDescriptionsItem>
                <NDescriptionsItem label="解决率">
                  {{ currentReport.resolvedRate }}%
                </NDescriptionsItem>
                <NDescriptionsItem label="平均解决时长">
                  {{ Math.round(currentReport.averageResolutionTime / 60000) }} 分钟
                </NDescriptionsItem>
              </NDescriptions>

              <NDivider>改进建议</NDivider>
              <NList size="small" bordered>
                <NListItem v-for="(rec, idx) in currentReport.recommendations" :key="idx">
                  {{ idx + 1 }}. {{ rec }}
                </NListItem>
              </NList>
            </NSpace>
          </NTabPane>

          <NTabPane name="statistics" tab="详细统计">
            <NSpace vertical style="width: 100%; padding: 8px 0">
              <div>
                <NText strong style="margin-bottom: 8px; display: block">按类型分布</NText>
                <NSpace wrap>
                  <NTag
                    v-for="(count, type) in currentReport.issuesByType"
                    :key="type"
                    v-show="count > 0"
                    size="large"
                  >
                    {{ getBreakTypeLabel(type as string) }}: {{ count }}
                  </NTag>
                </NSpace>
              </div>

              <div>
                <NText strong style="margin-bottom: 8px; display: block">按严重度分布</NText>
                <NSpace wrap>
                  <NTag
                    v-for="(count, sev) in currentReport.issuesBySeverity"
                    :key="sev"
                    size="large"
                    :type="sev === 'high' ? 'error' : sev === 'medium' ? 'warning' : 'default'"
                  >
                    {{ getSeverityLabel(sev as string) }}: {{ count }}
                  </NTag>
                </NSpace>
              </div>

              <div>
                <NText strong style="margin-bottom: 8px; display: block">按状态分布</NText>
                <NSpace wrap>
                  <NTag v-for="(count, status) in currentReport.issuesByStatus" :key="status" size="large">
                    {{ getStatusLabel(status as string) }}: {{ count }}
                  </NTag>
                </NSpace>
              </div>

              <div>
                <NText strong style="margin-bottom: 8px; display: block">按优先级分布</NText>
                <NSpace wrap>
                  <NTag
                    v-for="(count, priority) in currentReport.issuesByPriority"
                    :key="priority"
                    size="large"
                    :type="priority === 'urgent' ? 'error' : priority === 'high' ? 'warning' : priority === 'medium' ? 'info' : 'default'"
                  >
                    {{ getPriorityLabel(priority as string) }}: {{ count }}
                  </NTag>
                </NSpace>
              </div>

              <NDivider>人员贡献</NDivider>
              <NList size="small" bordered>
                <NListItem
                  v-for="(stats, name) in currentReport.assigneeStats"
                  :key="name"
                >
                  <NSpace justify="space-between" style="width: 100%">
                    <NText strong>{{ name }}</NText>
                    <NSpace>
                      <NTag size="small">分配: {{ stats.assigned }}</NTag>
                      <NTag type="success" size="small">解决: {{ stats.resolved }}</NTag>
                    </NSpace>
                  </NSpace>
                </NListItem>
              </NList>
            </NSpace>
          </NTabPane>
        </NTabs>
      </template>
      <template #footer>
        <NSpace justify="space-between" style="width: 100%">
          <NSpace>
            <NRadioGroup v-model:value="selectedExportFormat" size="small">
              <NSpace>
                <NRadio value="text">TXT</NRadio>
                <NRadio value="json">JSON</NRadio>
              </NSpace>
            </NRadioGroup>
            <NButton type="primary" size="small" @click="handleExportReport">
              导出报告
            </NButton>
          </NSpace>
          <NButton @click="showReportModal = false">关闭</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
