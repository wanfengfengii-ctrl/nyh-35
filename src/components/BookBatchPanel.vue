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
  NPopconfirm,
  NUpload,
  NUploadDragger,
  NIcon,
  NProgress,
  NDescriptions,
  NDescriptionsItem,
  NDataTable,
  type DataTableColumns,
  type UploadCustomRequestOptions,
  type SelectOption
} from 'naive-ui'
import {
  BookStatus,
  BookStatusLabel,
  SpreadLayout,
  SpreadLayoutLabel,
  AlignmentMethod,
  AlignmentMethodLabel,
  ProofreadingStatus,
  ProofreadingStatusLabel,
  type BookSpread
} from '@/types'

const store = useMainStore()

const showCreateBookModal = ref(false)
const newBookName = ref('')
const newBookPages = ref(10)
const newBookDescription = ref('')

const selectedAlignmentMethod = ref<AlignmentMethod>(AlignmentMethod.BLOCK_CENTER)
const isBatchProcessing = ref(false)

const layoutOptions: SelectOption[] = Object.entries(SpreadLayoutLabel).map(
  ([value, label]) => ({ label, value })
)

const alignmentOptions: SelectOption[] = Object.entries(AlignmentMethodLabel).map(
  ([value, label]) => ({ label, value })
)

const bookSpreadColumns: DataTableColumns<BookSpread> = [
  {
    title: '序号',
    key: 'sequence',
    width: 70,
    render: (row) => `第 ${row.sequence} 跨`
  },
  {
    title: '左页',
    key: 'leftPageIndex',
    width: 80,
    render: (row) => `第 ${row.leftPageIndex + 1} 页`
  },
  {
    title: '右页',
    key: 'rightPageIndex',
    width: 80,
    render: (row) => `第 ${row.rightPageIndex + 1} 页`
  },
  {
    title: '对齐置信度',
    key: 'alignmentConfidence',
    width: 100,
    render: (row) => {
      const confidence = row.alignmentConfidence
      const color = confidence >= 80 ? 'success' : confidence >= 60 ? 'warning' : 'error'
      return h(
        NTag,
        { type: color as any, size: 'small' },
        { default: () => `${confidence}%` }
      )
    }
  },
  {
    title: '问题数',
    key: 'breakCount',
    width: 80,
    render: (row) => {
      if (row.breakCount === 0) {
        return h(NTag, { type: 'success', size: 'small' }, { default: () => '无' })
      }
      return h(
        NBadge,
        { value: row.breakCount, type: 'error' },
        { default: () => h(NText, { depth: 3 }, { default: () => `${row.resolvedBreakCount}/${row.breakCount}` }) }
      )
    }
  },
  {
    title: '校对状态',
    key: 'proofreadingStatus',
    width: 100,
    render: (row) => {
      const statusMap: Record<ProofreadingStatus, 'default' | 'info' | 'warning' | 'success'> = {
        [ProofreadingStatus.NOT_STARTED]: 'default',
        [ProofreadingStatus.IN_PROGRESS]: 'info',
        [ProofreadingStatus.REVIEWED]: 'warning',
        [ProofreadingStatus.FINALIZED]: 'success'
      }
      return h(
        NTag,
        { type: statusMap[row.proofreadingStatus], size: 'small' },
        { default: () => ProofreadingStatusLabel[row.proofreadingStatus] }
      )
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
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
                onClick: () => handleViewSpread(row.spreadId)
              },
              { default: () => '查看' }
            )
          ]
        }
      )
  }
]

function handleCreateBook() {
  if (!newBookName.value.trim()) {
    window.$message?.warning('请输入书籍名称')
    return
  }
  store.addBook(newBookName.value.trim(), newBookPages.value, newBookDescription.value.trim())
  showCreateBookModal.value = false
  newBookName.value = ''
  newBookPages.value = 10
  newBookDescription.value = ''
  window.$message?.success('整册项目已创建')
}

function handleDeleteBook(bookId: string) {
  store.deleteBook(bookId)
  window.$message?.success('已删除')
}

function handleSwitchBook(bookId: string) {
  store.switchBook(bookId)
}

async function handleUploadPages(options: UploadCustomRequestOptions) {
  const file = options.file.file as File
  const files = options.fileList?.map((f) => f.file as File) || [file]
  await store.loadBookPageImages(files)
  window.$message?.success(`已加载 ${store.bookPageImages.length} 页书页图像`)
  options.onFinish()
}

function handleGenerateSpreads() {
  const result = store.generateBookSpreadsFromImages()
  if (result.success) {
    window.$message?.success(result.message)
  } else {
    window.$message?.warning(result.message)
  }
}

function handleBatchAlign() {
  if (!store.currentBook) {
    window.$message?.warning('请先选择整册项目')
    return
  }
  isBatchProcessing.value = true
  setTimeout(() => {
    const result = store.batchAlignBookSpreads(selectedAlignmentMethod.value)
    isBatchProcessing.value = false
    if (result.success) {
      window.$message?.success(result.message)
    } else {
      window.$message?.warning(result.message)
    }
  }, 500)
}

function handleBatchDetect() {
  if (!store.currentBook) {
    window.$message?.warning('请先选择整册项目')
    return
  }
  isBatchProcessing.value = true
  setTimeout(() => {
    const result = store.batchDetectBookBreaks()
    isBatchProcessing.value = false
    if (result.success) {
      window.$message?.success(result.message)
    } else {
      window.$message?.warning(result.message)
    }
  }, 500)
}

function handleViewSpread(spreadId: string) {
  store.switchSpread(spreadId)
  store.setSpreadMode(true)
  store.setBookBatchMode(false)
  window.$message?.info('已切换到跨页视图')
}

function handleRunAllBatch() {
  if (!store.currentBook) {
    window.$message?.warning('请先选择整册项目')
    return
  }
  isBatchProcessing.value = true
  setTimeout(() => {
    const alignResult = store.batchAlignBookSpreads(selectedAlignmentMethod.value)
    const detectResult = store.batchDetectBookBreaks()
    isBatchProcessing.value = false
    window.$message?.success(
      `批处理完成：对齐 ${alignResult.processed}/${alignResult.total} 个，生成 ${detectResult.totalIssues} 个问题`
    )
  }, 800)
}
</script>

<template>
  <div style="padding: 8px; overflow-y: auto; max-height: calc(100vh - 180px)">
    <NSpace vertical style="width: 100%">
      <NCard size="small" title="📚 整册项目管理">
        <NSpace vertical style="width: 100%">
          <NSpace>
            <NButton type="primary" size="small" @click="showCreateBookModal = true">
              + 新建整册项目
            </NButton>
          </NSpace>
          <div v-if="store.books.length === 0">
            <NEmpty description="暂无整册项目" size="small" />
          </div>
          <NList v-else size="small" bordered>
            <NListItem v-for="book in store.books" :key="book.id">
              <template #prefix>
                <NBadge
                  v-if="store.currentBookId === book.id"
                  value="当前"
                  type="success"
                />
              </template>
              <NSpace justify="space-between" style="width: 100%">
                <div>
                  <NText strong>{{ book.name }}</NText>
                  <br />
                  <NText depth="3" style="font-size: 12px">
                    {{ BookStatusLabel[book.status] }} · {{ book.totalPages }} 页
                  </NText>
                </div>
                <NSpace size="tiny">
                  <NButton
                    size="tiny"
                    type="primary"
                    :disabled="store.currentBookId === book.id"
                    @click="handleSwitchBook(book.id)"
                  >
                    切换
                  </NButton>
                  <NPopconfirm @positive-click="handleDeleteBook(book.id)">
                    <template #trigger>
                      <NButton size="tiny" type="error">删除</NButton>
                    </template>
                    确认删除此整册项目？所有相关数据将被清除。
                  </NPopconfirm>
                </NSpace>
              </NSpace>
            </NListItem>
          </NList>
        </NSpace>
      </NCard>

      <template v-if="store.currentBook">
        <NCard size="small" title="📖 整册信息">
          <NDescriptions label-placement="left" size="small" :column="1" bordered>
            <NDescriptionsItem label="名称">
              {{ store.currentBook.name }}
            </NDescriptionsItem>
            <NDescriptionsItem label="作者">
              {{ store.currentBook.author }}
            </NDescriptionsItem>
            <NDescriptionsItem label="状态">
              <NTag round>
                {{ BookStatusLabel[store.currentBook.status] }}
              </NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="总页数">
              {{ store.currentBook.totalPages }} 页
            </NDescriptionsItem>
            <NDescriptionsItem label="跨页数">
              {{ store.currentBookSpreads.length }} 个
            </NDescriptionsItem>
            <NDescriptionsItem label="版式">
              {{ SpreadLayoutLabel[store.currentBook.layout] }}
            </NDescriptionsItem>
            <NDescriptionsItem v-if="store.currentBook.description" label="描述">
              {{ store.currentBook.description }}
            </NDescriptionsItem>
          </NDescriptions>
        </NCard>

        <NCard size="small" title="📄 书页图像">
          <NSpace vertical style="width: 100%">
            <NUpload
              :custom-request="handleUploadPages"
              :show-file-list="false"
              accept="image/*"
              multiple
            >
              <NUploadDragger>
                <div style="padding: 12px; text-align: center">
                  <NText depth="3">📁 点击或拖拽图片到此处批量导入书页</NText>
                  <br />
                  <NText depth="3" style="font-size: 12px">
                    支持多选，按文件名顺序排列
                  </NText>
                </div>
              </NUploadDragger>
            </NUpload>
            <div v-if="store.bookPageImages.length > 0">
              <NAlert type="success" style="margin-top: 8px">
                已加载 {{ store.bookPageImages.length }} 页书页图像
              </NAlert>
            </div>
          </NSpace>
        </NCard>

        <NCard size="small" title="⚡ 批量处理">
          <NSpace vertical style="width: 100%">
            <NForm label-placement="left" label-width="80px" size="small">
              <NFormItem label="对齐方式">
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
              </NFormItem>
            </NForm>

            <NSpace wrap>
              <NButton
                type="primary"
                size="small"
                :disabled="store.bookPageImages.length < 2"
                :loading="isBatchProcessing"
                @click="handleGenerateSpreads"
              >
                1. 批量生成跨页
              </NButton>
              <NButton
                type="primary"
                size="small"
                :disabled="store.currentBookSpreads.length === 0"
                :loading="isBatchProcessing"
                @click="handleBatchAlign"
              >
                2. 批量对齐
              </NButton>
              <NButton
                type="primary"
                size="small"
                :disabled="store.currentBookSpreads.length === 0"
                :loading="isBatchProcessing"
                @click="handleBatchDetect"
              >
                3. 批量检测问题
              </NButton>
              <NButton
                type="success"
                size="small"
                :disabled="store.currentBookSpreads.length === 0"
                :loading="isBatchProcessing"
                @click="handleRunAllBatch"
              >
                一键全部执行
              </NButton>
            </NSpace>

            <NAlert v-if="store.currentBookSpreads.length > 0" type="info" style="margin-top: 8px">
              已生成 {{ store.currentBookSpreads.length }} 个跨页视图
            </NAlert>
          </NSpace>
        </NCard>

        <NCard size="small" title="📋 跨页列表">
          <NSpace vertical style="width: 100%">
            <div v-if="store.currentBookSpreads.length === 0">
              <NEmpty description="暂无跨页数据" size="small" />
            </div>
            <NDataTable
              v-else
              :columns="bookSpreadColumns"
              :data="store.currentBookSpreads"
              :row-key="(r) => r.id"
              size="small"
              :max-height="400"
              :pagination="false"
            />
          </NSpace>
        </NCard>

        <template v-if="store.currentBookProgress">
          <NCard size="small" title="📊 进度概览">
            <NSpace vertical style="width: 100%">
              <div>
                <NSpace justify="space-between" style="margin-bottom: 4px">
                  <NText>校对进度</NText>
                  <NText strong>{{ store.currentBookProgress.progressPercentage }}%</NText>
                </NSpace>
                <NProgress
                  :percentage="store.currentBookProgress.progressPercentage"
                  :stroke-width="8"
                />
              </div>
              <NSpace wrap>
                <NTag type="info" size="small">
                  总跨页: {{ store.currentBookProgress.totalSpreads }}
                </NTag>
                <NTag type="success" size="small">
                  已完成: {{ store.currentBookProgress.completedSpreads }}
                </NTag>
                <NTag type="warning" size="small">
                  进行中: {{ store.currentBookProgress.inProgressSpreads }}
                </NTag>
                <NTag type="error" size="small">
                  待处理: {{ store.currentBookProgress.openIssues }}
                </NTag>
                <NTag type="error" v-if="store.currentBookProgress.highPriorityIssues > 0" size="small">
                  高优先级: {{ store.currentBookProgress.highPriorityIssues }}
                </NTag>
              </NSpace>
            </NSpace>
          </NCard>
        </template>
      </template>
    </NSpace>

    <NModal v-model:show="showCreateBookModal" preset="card" title="新建整册项目" style="width: 460px">
      <NForm label-placement="left" label-width="80px">
        <NFormItem label="名称" required>
          <NInput v-model:value="newBookName" placeholder="请输入书籍名称" />
        </NFormItem>
        <NFormItem label="总页数">
          <NInput
            v-model:value="newBookPages"
            type="number"
            :min="1"
            placeholder="预估总页数"
          />
        </NFormItem>
        <NFormItem label="描述">
          <NInput v-model:value="newBookDescription" type="textarea" placeholder="书籍描述信息" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showCreateBookModal = false">取消</NButton>
          <NButton type="primary" @click="handleCreateBook">创建</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
