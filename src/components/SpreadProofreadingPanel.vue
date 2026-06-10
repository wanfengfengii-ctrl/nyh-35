<script setup lang="ts">
import { ref, computed, watch, h } from 'vue'
import { useMainStore } from '@/stores/main'
import {
  NButton,
  NCard,
  NSpace,
  NInput,
  NSelect,
  NSlider,
  NTag,
  NText,
  NEmpty,
  NList,
  NListItem,
  NModal,
  NForm,
  NFormItem,
  NDivider,
  NAlert,
  NBadge,
  NRadio,
  NRadioGroup,
  NNumberAnimation,
  NPopconfirm,
  NUpload,
  NUploadDragger,
  NIcon,
  NTabs,
  NTabPane,
  NDescriptions,
  NDescriptionsItem,
  NDataTable,
  type DataTableColumns,
  type UploadCustomRequestOptions,
  type SelectOption
} from 'naive-ui'
import {
  SpreadLayout,
  SpreadLayoutLabel,
  AlignmentMethod,
  AlignmentMethodLabel,
  BreakTypeLabel,
  BreakSeverityLabel,
  BreakSeverity,
  ProofreadingStatus,
  ProofreadingStatusLabel,
  type BreakRegion,
  type SpreadConsistencyReport
} from '@/types'
import {
  exportReportAsText,
  exportReportAsCSV,
  exportReportAsJSON,
  formatTimestamp
} from '@/utils/proofreadingReport'

const store = useMainStore()

const newSpreadName = ref('跨页视图-' + Date.now())
const showCreateSpreadModal = ref(false)
const showReportModal = ref(false)
const showBreakReviewModal = ref(false)
const currentReviewBreak = ref<BreakRegion | null>(null)
const reviewComment = ref('')
const reviewResolved = ref(false)
const currentReport = ref<SpreadConsistencyReport | null>(null)
const selectedExportFormat = ref<'text' | 'csv' | 'json'>('text')
const selectedAlignmentMethod = ref<AlignmentMethod>(AlignmentMethod.BLOCK_CENTER)

const layoutOptions: SelectOption[] = Object.entries(SpreadLayoutLabel).map(
  ([value, label]) => ({ label, value })
)

const alignmentOptions: SelectOption[] = Object.entries(AlignmentMethodLabel).map(
  ([value, label]) => ({ label, value })
)

const breaksColumns: DataTableColumns<BreakRegion> = [
  {
    title: '类型',
    key: 'breakType',
    width: 100,
    render: (row) => BreakTypeLabel[row.breakType]
  },
  {
    title: '严重度',
    key: 'severity',
    width: 80,
    render: (row) => {
      const tagType: Record<BreakSeverity, 'default' | 'warning' | 'error'> = {
        [BreakSeverity.LOW]: 'default',
        [BreakSeverity.MEDIUM]: 'warning',
        [BreakSeverity.HIGH]: 'error'
      }
      return h(
        NTag,
        { type: tagType[row.severity], size: 'small' },
        { default: () => BreakSeverityLabel[row.severity] }
      )
    }
  },
  {
    title: '描述',
    key: 'description',
    ellipsis: { tooltip: true }
  },
  {
    title: '状态',
    key: 'status',
    width: 90,
    render: (row) =>
      row.resolved
        ? h(NTag, { type: 'success', size: 'small' }, { default: () => '已解决' })
        : row.reviewed
          ? h(NTag, { type: 'warning', size: 'small' }, { default: () => '已复核' })
          : h(NTag, { type: 'info', size: 'small' }, { default: () => '待处理' })
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
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
                onClick: () => openReviewModal(row)
              },
              { default: () => '校对' }
            ),
            h(
              NButton,
              {
                size: 'tiny',
                onClick: () => store.selectBreak(row.id)
              },
              { default: () => '定位' }
            )
          ]
        }
      )
  }
]

function handleCreateSpread() {
  if (!newSpreadName.value.trim()) {
    window.$message?.warning('请输入跨页视图名称')
    return
  }
  store.createSpread(newSpreadName.value.trim(), SpreadLayout.RIGHT_LEFT)
  showCreateSpreadModal.value = false
  newSpreadName.value = '跨页视图-' + Date.now()
  window.$message?.success('跨页视图已创建')
}

function handleDeleteSpread(spreadId: string) {
  store.deleteSpread(spreadId)
  window.$message?.success('已删除')
}

function handleRenameSpread(spreadId: string, newName: string) {
  if (newName && newName.trim()) {
    store.renameSpread(spreadId, newName.trim())
  }
}

async function handleAddPageImage(options: UploadCustomRequestOptions) {
  if (!store.currentSpreadId) {
    window.$message?.warning('请先选择跨页视图')
    return
  }
  const file = options.file.file as File
  const result = await store.addPageImageToSpread(store.currentSpreadId, file)
  if (result.valid) {
    window.$message?.success(result.message)
  } else {
    window.$message?.error(result.message)
  }
  options.onFinish()
}

function handleRemovePage(pageId: string) {
  if (!store.currentSpreadId) return
  store.removePageFromSpreadStore(store.currentSpreadId, pageId)
  window.$message?.success('书页已移除')
}

function handleMovePage(from: number, to: number) {
  if (!store.currentSpreadId) return
  store.movePageInSpread(store.currentSpreadId, from, to)
}

function handleAdjustOffset(pageId: string, field: 'offsetX' | 'offsetY', value: number) {
  if (!store.currentSpreadId) return
  store.adjustPageOffset(store.currentSpreadId, pageId, { [field]: value })
}

function handleAdjustScale(pageId: string, value: number) {
  if (!store.currentSpreadId) return
  store.adjustPageOffset(store.currentSpreadId, pageId, { scale: value / 100 })
}

function handleAutoAlign(method: AlignmentMethod) {
  if (!store.currentSpreadId) return
  const result = store.runAutoAlignment(store.currentSpreadId, method)
  if (result.valid) {
    window.$message?.success(result.message)
  } else {
    window.$message?.warning(result.message)
  }
}

function handleDetectBreaks() {
  if (!store.currentSpreadId) return
  const result = store.runBreakDetection(store.currentSpreadId)
  if (result.valid) {
    window.$message?.success(result.message)
  } else {
    window.$message?.warning(result.message)
  }
}

function openReviewModal(breakRegion: BreakRegion) {
  currentReviewBreak.value = breakRegion
  reviewComment.value = breakRegion.reviewComment || ''
  reviewResolved.value = breakRegion.resolved
  showBreakReviewModal.value = true
}

function handleSaveReview() {
  if (!currentReviewBreak.value) return
  const result = store.reviewBreak(
    currentReviewBreak.value.id,
    reviewComment.value,
    reviewResolved.value
  )
  if (result.valid) {
    window.$message?.success(result.message)
    showBreakReviewModal.value = false
  } else {
    window.$message?.warning(result.message)
  }
}

function handleStartProofreading() {
  if (!store.currentSpreadId) return
  store.startProofreading(store.currentSpreadId)
  window.$message?.success('已开始校对')
}

function handleFinishProofreading(status: ProofreadingStatus) {
  if (!store.currentSpreadProofreading) return
  const result = store.finishProofreading(
    store.currentSpreadProofreading.id,
    status,
    store.currentSpreadProofreading.notes
  )
  if (result.valid) {
    window.$message?.success(result.message)
  } else {
    window.$message?.warning(result.message)
  }
}

function handleGenerateReport() {
  if (!store.currentSpreadId) return
  const report = store.generateSpreadReport(store.currentSpreadId)
  if (report) {
    currentReport.value = report
    showReportModal.value = true
  }
}

function handleExportReport() {
  if (!currentReport.value) return
  let content = ''
  let mimeType = 'text/plain'
  let extension = 'txt'
  switch (selectedExportFormat.value) {
    case 'csv':
      content = exportReportAsCSV(currentReport.value)
      mimeType = 'text/csv'
      extension = 'csv'
      break
    case 'json':
      content = exportReportAsJSON(currentReport.value)
      mimeType = 'application/json'
      extension = 'json'
      break
    default:
      content = exportReportAsText(currentReport.value)
  }
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `跨页一致性报告_${currentReport.value.spreadName}_${Date.now()}.${extension}`
  a.click()
  URL.revokeObjectURL(url)
  window.$message?.success('报告已导出')
}

function handleAssociateCurrentScheme(pageId: string) {
  if (!store.currentSpreadId || !store.currentScheme) {
    window.$message?.warning('请先创建或选择切分方案')
    return
  }
  store.associateSchemeToPage(store.currentSpreadId, pageId, store.currentScheme)
  window.$message?.success('已关联当前方案')
}
</script>

<template>
  <div style="padding: 8px; overflow-y: auto; max-height: calc(100vh - 180px)">
    <NSpace vertical style="width: 100%">
      <NCard size="small" title="📖 跨页视图管理">
        <NSpace vertical style="width: 100%">
          <NSpace>
            <NButton type="primary" size="small" @click="showCreateSpreadModal = true">
              + 新建跨页
            </NButton>
          </NSpace>
          <div v-if="store.spreads.length === 0">
            <NEmpty description="暂无跨页视图" size="small" />
          </div>
          <NList v-else size="small" bordered>
            <NListItem v-for="s in store.spreads" :key="s.id">
              <template #prefix>
                <NBadge
                  v-if="store.currentSpreadId === s.id"
                  value="当前"
                  type="success"
                />
              </template>
              <NSpace justify="space-between" style="width: 100%">
                <div>
                  <NText strong>{{ s.name }}</NText>
                  <br />
                  <NText depth="3" style="font-size: 12px">
                    {{ SpreadLayoutLabel[s.layout] }} · {{ s.pages.length }} 页
                  </NText>
                </div>
                <NSpace size="tiny">
                  <NButton
                    size="tiny"
                    type="primary"
                    :disabled="store.currentSpreadId === s.id"
                    @click="store.switchSpread(s.id)"
                  >
                    切换
                  </NButton>
                  <NPopconfirm @positive-click="handleDeleteSpread(s.id)">
                    <template #trigger>
                      <NButton size="tiny" type="error">删除</NButton>
                    </template>
                    确认删除此跨页视图？
                  </NPopconfirm>
                </NSpace>
              </NSpace>
            </NListItem>
          </NList>
        </NSpace>
      </NCard>

      <template v-if="store.currentSpread">
        <NCard size="small" title="⚙️ 跨页设置">
          <NSpace vertical style="width: 100%">
            <NForm label-placement="left" label-width="80px" size="small">
              <NFormItem label="名称">
                <NInput
                  :value="store.currentSpread.name"
                  @update:value="(v) => handleRenameSpread(store.currentSpread!.id, v)"
                />
              </NFormItem>
              <NFormItem label="版式">
                <NSelect
                  :value="store.currentSpread.layout"
                  :options="layoutOptions"
                  @update:value="(v) => store.setSpreadLayout(store.currentSpread!.id, v as SpreadLayout)"
                />
              </NFormItem>
              <NFormItem label="页缝">
                <NSpace style="width: 100%">
                  <NSlider
                    :value="store.currentSpread.pageGap"
                    :min="0"
                    :max="100"
                    style="flex: 1"
                    @update:value="(v) => store.setPageGap(store.currentSpread!.id, v)"
                  />
                  <NText style="width: 50px; text-align: right">
                    {{ store.currentSpread.pageGap }}px
                  </NText>
                </NSpace>
              </NFormItem>
            </NForm>
          </NSpace>
        </NCard>

        <NCard size="small" title="📄 书页管理">
          <NSpace vertical style="width: 100%">
            <NUpload
              :custom-request="handleAddPageImage"
              :show-file-list="false"
              accept="image/*"
              multiple
            >
              <NUploadDragger>
                <div style="padding: 12px; text-align: center">
                  <NText depth="3">📁 点击或拖拽图片到此处添加书页</NText>
                </div>
              </NUploadDragger>
            </NUpload>

            <div v-if="store.currentSpread.pages.length === 0">
              <NEmpty description="尚未添加书页" size="small" />
            </div>

            <div
              v-for="(page, index) in store.currentSpread.pages"
              :key="page.pageId"
              style="border: 1px solid #eee; border-radius: 6px; padding: 8px; margin-bottom: 8px"
            >
              <NSpace justify="space-between" align="center">
                <NText strong>第 {{ index + 1 }} 页 · {{ page.image.name }}</NText>
                <NSpace size="tiny">
                  <NButton
                    size="tiny"
                    :disabled="index === 0"
                    @click="handleMovePage(index, index - 1)"
                  >
                    ←
                  </NButton>
                  <NButton
                    size="tiny"
                    :disabled="index === store.currentSpread!.pages.length - 1"
                    @click="handleMovePage(index, index + 1)"
                  >
                    →
                  </NButton>
                  <NPopconfirm @positive-click="handleRemovePage(page.pageId)">
                    <template #trigger>
                      <NButton size="tiny" type="error">移除</NButton>
                    </template>
                    确认移除此书页？
                  </NPopconfirm>
                </NSpace>
              </NSpace>
              <NForm label-placement="left" label-width="60px" size="small" style="margin-top: 8px">
                <NFormItem label="X偏移">
                  <NSlider
                    :value="page.offset.offsetX"
                    :min="-200"
                    :max="200"
                    :step="1"
                    @update:value="(v) => handleAdjustOffset(page.pageId, 'offsetX', v)"
                  />
                </NFormItem>
                <NFormItem label="Y偏移">
                  <NSlider
                    :value="page.offset.offsetY"
                    :min="-200"
                    :max="200"
                    :step="1"
                    @update:value="(v) => handleAdjustOffset(page.pageId, 'offsetY', v)"
                  />
                </NFormItem>
                <NFormItem label="缩放">
                  <NSlider
                    :value="Math.round(page.offset.scale * 100)"
                    :min="50"
                    :max="150"
                    @update:value="(v) => handleAdjustScale(page.pageId, v)"
                  />
                </NFormItem>
                <NFormItem label="方案">
                  <NSpace>
                    <NText depth="3" v-if="page.scheme">
                      已关联：{{ page.scheme.name }} ({{ page.scheme.regions.length }} 区域)
                    </NText>
                    <NText depth="3" v-else>未关联</NText>
                    <NButton
                      size="tiny"
                      type="primary"
                      @click="handleAssociateCurrentScheme(page.pageId)"
                    >
                      关联当前方案
                    </NButton>
                  </NSpace>
                </NFormItem>
              </NForm>
            </div>
          </NSpace>
        </NCard>

        <NCard size="small" title="🎯 自动对齐">
          <NSpace vertical style="width: 100%">
            <NRadioGroup v-model:value="selectedAlignmentMethod">
              <NSpace>
                <NRadio :value="AlignmentMethod.BLOCK_CENTER">
                  {{ AlignmentMethodLabel[AlignmentMethod.BLOCK_CENTER] }}
                </NRadio>
                <NRadio :value="AlignmentMethod.COLUMN_LINE">
                  {{ AlignmentMethodLabel[AlignmentMethod.COLUMN_LINE] }}
                </NRadio>
                <NRadio :value="AlignmentMethod.CONTENT_FEATURE">
                  {{ AlignmentMethodLabel[AlignmentMethod.CONTENT_FEATURE] }}
                </NRadio>
              </NSpace>
            </NRadioGroup>
            <NSpace>
              <NButton
                type="primary"
                size="small"
                :disabled="store.currentSpread.pages.length < 2"
                @click="handleAutoAlign(selectedAlignmentMethod)"
              >
                执行自动对齐
              </NButton>
              <NTag v-if="store.lastAlignmentResult" size="small" round>
                置信度: {{ store.lastAlignmentResult.confidence }}%
              </NTag>
            </NSpace>
            <NText depth="3" v-if="store.lastAlignmentResult" style="font-size: 12px">
              {{ store.lastAlignmentResult.details }}
            </NText>
          </NSpace>
        </NCard>

        <NCard size="small" title="🔍 断裂检测与校对">
          <NSpace vertical style="width: 100%">
            <NSpace>
              <NButton
                type="primary"
                size="small"
                :disabled="store.currentSpread.pages.length < 2"
                @click="handleDetectBreaks"
              >
                检测跨页断裂
              </NButton>
              <NButton
                size="small"
                @click="store.setShowBreakHighlights(!store.showBreakHighlights)"
              >
                {{ store.showBreakHighlights ? '隐藏高亮' : '显示高亮' }}
              </NButton>
              <NButton size="small" @click="store.clearBreaks">清除结果</NButton>
              <NBadge :value="store.spreadBreaks.length" v-if="store.spreadBreaks.length > 0">
                <NTag size="small" round type="info">
                  待处理 {{ store.unresolvedBreaks.length }}
                </NTag>
              </NBadge>
            </NSpace>

            <div v-if="store.spreadBreaks.length === 0">
              <NEmpty description="暂无检测结果" size="small" />
            </div>

            <NDataTable
              v-else
              :columns="breaksColumns"
              :data="store.spreadBreaks"
              :row-key="(r) => r.id"
              size="small"
              :max-height="300"
              :pagination="false"
            />
          </NSpace>
        </NCard>

        <NCard size="small" title="📝 校对记录">
          <NSpace vertical style="width: 100%">
            <template v-if="!store.currentSpreadProofreading">
              <NButton type="primary" size="small" @click="handleStartProofreading">
                开始校对
              </NButton>
            </template>
            <template v-else>
              <NDescriptions label-placement="left" size="small" :column="1" bordered>
                <NDescriptionsItem label="状态">
                  <NTag round>
                    {{ ProofreadingStatusLabel[store.currentSpreadProofreading.status] }}
                  </NTag>
                </NDescriptionsItem>
                <NDescriptionsItem label="操作人">
                  {{ store.currentSpreadProofreading.operator }}
                </NDescriptionsItem>
                <NDescriptionsItem label="开始时间">
                  {{ formatTimestamp(store.currentSpreadProofreading.startTime) }}
                </NDescriptionsItem>
                <NDescriptionsItem v-if="store.currentSpreadProofreading.endTime" label="结束时间">
                  {{ formatTimestamp(store.currentSpreadProofreading.endTime) }}
                </NDescriptionsItem>
              </NDescriptions>
              <NFormItem label="备注">
                <NInput
                  type="textarea"
                  :value="store.currentSpreadProofreading.notes"
                  placeholder="输入校对备注..."
                  @update:value="
                    (v) => {
                      if (store.currentSpreadProofreading) {
                        store.currentSpreadProofreading.notes = v
                      }
                    }
                  "
                />
              </NFormItem>
              <NSpace v-if="store.currentSpreadProofreading.status === ProofreadingStatus.IN_PROGRESS">
                <NButton
                  size="small"
                  type="success"
                  @click="handleFinishProofreading(ProofreadingStatus.REVIEWED)"
                >
                  提交复核
                </NButton>
                <NButton
                  size="small"
                  type="primary"
                  @click="handleFinishProofreading(ProofreadingStatus.FINALIZED)"
                >
                  定稿完成
                </NButton>
              </NSpace>
            </template>
          </NSpace>
        </NCard>

        <NCard size="small" title="📑 一致性报告">
          <NSpace vertical style="width: 100%">
            <NButton
              type="primary"
              size="small"
              :disabled="store.currentSpread.pages.length < 2"
              @click="handleGenerateReport"
            >
              生成跨页一致性报告
            </NButton>
            <NAlert v-if="store.currentSpreadProofreading" type="info" style="margin-top: 8px">
              校对状态：{{ ProofreadingStatusLabel[store.currentSpreadProofreading.status] }}
              <br />
              断裂问题：{{ store.spreadBreaks.length }} 个（已解决 {{ store.reviewedBreaks.filter(b => b.resolved).length }} 个）
            </NAlert>
          </NSpace>
        </NCard>
      </template>
    </NSpace>

    <NModal v-model:show="showCreateSpreadModal" preset="card" title="新建跨页视图" style="width: 420px">
      <NForm label-placement="left" label-width="80px">
        <NFormItem label="名称" required>
          <NInput v-model:value="newSpreadName" placeholder="请输入跨页视图名称" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showCreateSpreadModal = false">取消</NButton>
          <NButton type="primary" @click="handleCreateSpread">创建</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="showBreakReviewModal" preset="card" title="校对断裂问题" style="width: 500px">
      <template v-if="currentReviewBreak">
        <NDescriptions label-placement="left" size="small" :column="1" bordered>
          <NDescriptionsItem label="类型">
            {{ BreakTypeLabel[currentReviewBreak.breakType] }}
          </NDescriptionsItem>
          <NDescriptionsItem label="严重度">
            <NTag
              :type="
                currentReviewBreak.severity === BreakSeverity.HIGH
                  ? 'error'
                  : currentReviewBreak.severity === BreakSeverity.MEDIUM
                    ? 'warning'
                    : 'default'
              "
              round
            >
              {{ BreakSeverityLabel[currentReviewBreak.severity] }}
            </NTag>
          </NDescriptionsItem>
          <NDescriptionsItem label="描述">
            {{ currentReviewBreak.description }}
          </NDescriptionsItem>
          <NDescriptionsItem v-if="currentReviewBreak.reviewer" label="原复核人">
            {{ currentReviewBreak.reviewer }}
          </NDescriptionsItem>
        </NDescriptions>
        <NForm style="margin-top: 12px">
          <NFormItem label="处理意见">
            <NInput v-model:value="reviewComment" type="textarea" placeholder="请输入校对意见..." />
          </NFormItem>
          <NFormItem label="是否解决">
            <NRadioGroup v-model:value="reviewResolved">
              <NSpace>
                <NRadio :value="true">已解决</NRadio>
                <NRadio :value="false">待处理</NRadio>
              </NSpace>
            </NRadioGroup>
          </NFormItem>
        </NForm>
      </template>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showBreakReviewModal = false">取消</NButton>
          <NButton type="primary" @click="handleSaveReview">保存</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="showReportModal" preset="card" title="跨页一致性报告" style="width: 680px">
      <template v-if="currentReport">
        <NTabs type="line" size="small">
          <NTabPane name="overview" tab="概览">
            <NSpace vertical style="width: 100%; padding: 8px 0">
              <NAlert :type="currentReport.totalIssues === 0 ? 'success' : 'warning'">
                {{ currentReport.summary }}
              </NAlert>
              <NDescriptions label-placement="left" size="small" :column="2" bordered>
                <NDescriptionsItem label="跨页名称">
                  {{ currentReport.spreadName }}
                </NDescriptionsItem>
                <NDescriptionsItem label="生成时间">
                  {{ formatTimestamp(currentReport.generatedAt) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="生成人员">
                  {{ currentReport.generatedBy }}
                </NDescriptionsItem>
                <NDescriptionsItem label="校对状态">
                  {{ ProofreadingStatusLabel[currentReport.proofreadingStatus] }}
                </NDescriptionsItem>
                <NDescriptionsItem label="问题总数">
                  <NNumberAnimation :from="0" :to="currentReport.totalIssues" />
                </NDescriptionsItem>
                <NDescriptionsItem label="对齐置信度">
                  {{ currentReport.alignmentConfidence }}%
                </NDescriptionsItem>
                <NDescriptionsItem label="已解决">
                  <NTag type="success" round>{{ currentReport.resolvedCount }}</NTag>
                </NDescriptionsItem>
                <NDescriptionsItem label="待处理">
                  <NTag type="warning" round>{{ currentReport.unresolvedCount }}</NTag>
                </NDescriptionsItem>
              </NDescriptions>
              <NDivider>问题分布</NDivider>
              <NSpace>
                <NTag v-for="(count, type) in currentReport.issuesByType" :key="type" round>
                  {{ BreakTypeLabel[type as keyof typeof BreakTypeLabel] }}: {{ count }}
                </NTag>
              </NSpace>
              <NSpace>
                <NTag v-for="(count, sev) in currentReport.issuesBySeverity" :key="sev" round>
                  {{ BreakSeverityLabel[sev as keyof typeof BreakSeverityLabel] }}: {{ count }}
                </NTag>
              </NSpace>
            </NSpace>
          </NTabPane>
          <NTabPane name="issues" tab="问题清单">
            <NDataTable
              :columns="breaksColumns"
              :data="
                currentReport.issues.map((i) => ({
                  id: i.id,
                  breakType: i.breakType,
                  severity: i.severity,
                  description: i.description + ' | 建议: ' + i.suggestion,
                  leftRegionId: null,
                  rightRegionId: null,
                  position: { x: 0, y: 0, width: 0, height: 0 },
                  detectedAt: 0,
                  reviewed: false,
                  reviewer: null,
                  reviewComment: i.suggestion,
                  resolved: false,
                  resolvedAt: null
                }))
              "
              :row-key="(r) => r.id"
              size="small"
              :max-height="360"
              :pagination="false"
            />
          </NTabPane>
        </NTabs>
      </template>
      <template #footer>
        <NSpace justify="space-between" style="width: 100%">
          <NSpace>
            <NRadioGroup v-model:value="selectedExportFormat" size="small">
              <NSpace>
                <NRadio value="text">TXT</NRadio>
                <NRadio value="csv">CSV</NRadio>
                <NRadio value="json">JSON</NRadio>
              </NSpace>
            </NRadioGroup>
            <NButton type="primary" size="small" @click="handleExportReport">导出报告</NButton>
          </NSpace>
          <NButton @click="showReportModal = false">关闭</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
