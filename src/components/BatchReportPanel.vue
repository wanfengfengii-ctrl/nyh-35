<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMainStore } from '@/stores/main'
import {
  NCard,
  NButton,
  NSpace,
  NTag,
  NText,
  NIcon,
  NGrid,
  NGridItem,
  NStatistic,
  NDataTable,
  NEmpty,
  useMessage,
  NProgress
} from 'naive-ui'
import { h } from 'vue'
import {
  RegionCategoryLabel,
  RegionCategoryColor,
  RegionStatus,
  RegionStatusLabel,
  BatchReport
} from '@/types'
import { exportReportAsCSV, exportReportAsJSON, formatLogTimestamp } from '@/utils/reviewUtils'

const store = useMainStore()
const message = useMessage()

const report = ref<BatchReport | null>(null)

watch(
  () => [store.currentSchemeId, store.regions.length, store.conflicts.length, store.currentSchemeOpinions.length, store.candidates.length],
  () => {
    report.value = store.generateReport()
  },
  { immediate: true, deep: true }
)

function refreshReport() {
  report.value = store.generateReport()
  message.success('报表已刷新')
}

function exportCSV() {
  if (!report.value) return
  const csv = exportReportAsCSV(report.value)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `批量统计报表_${report.value.schemeName}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  message.success('CSV报表已导出')
}

function exportJSON() {
  if (!report.value) return
  const json = exportReportAsJSON(report.value)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `批量统计报表_${report.value.schemeName}_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  message.success('JSON报表已导出')
}

const categoryTableData = computed(() => {
  if (!report.value) return []
  const pageArea = store.pageImage ? store.pageImage.width * store.pageImage.height : 1
  return Object.entries(report.value.regionsByCategory)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => {
      const cat = category as keyof typeof report.value.regionsByCategory
      const area = report.value!.areaByCategory[cat]
      return {
        key: category,
        category: RegionCategoryLabel[cat],
        count,
        area: Math.round(area),
        ratio: (area / pageArea) * 100,
        color: RegionCategoryColor[cat]
      }
    })
})

const statusTableData = computed(() => {
  if (!report.value) return []
  return Object.entries(report.value.regionsByStatus)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      key: status,
      status: RegionStatusLabel[status as RegionStatus],
      count,
      ratio: report.value!.totalRegions > 0 ? (count / report.value!.totalRegions) * 100 : 0
    }))
})

const reviewerTableData = computed(() => {
  if (!report.value) return []
  return Object.entries(report.value.reviewerContributions).map(([name, count]) => ({
    key: name,
    reviewer: name,
    count
  }))
})

const categoryColumns = [
  { title: '类别', key: 'category' },
  { title: '数量', key: 'count', width: 70 },
  {
    title: '面积(px²)',
    key: 'area',
    width: 110,
    render: (row: { area: number }) => row.area.toLocaleString()
  },
  {
    title: '占比',
    key: 'ratio',
    render: (row: { ratio: number; color: string }) =>
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
        h(NProgress, {
          type: 'line',
          percentage: Math.round(row.ratio * 100) / 100,
          color: row.color,
          railStyle: { background: '#f0f0f0' },
          style: { flex: '1', maxWidth: '100px' }
        }),
        h(NText, { depth: 2, style: { fontSize: '12px', minWidth: '50px', textAlign: 'right' } },
          { default: () => `${row.ratio.toFixed(2)}%` })
      ])
  }
]

const statusColumns = [
  { title: '状态', key: 'status' },
  { title: '数量', key: 'count', width: 80 },
  {
    title: '占比',
    key: 'ratio',
    render: (row: { ratio: number }) =>
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
        h(NProgress, {
          type: 'line',
          percentage: Math.round(row.ratio * 100) / 100,
          style: { flex: '1', maxWidth: '100px' }
        }),
        h(NText, { depth: 2, style: { fontSize: '12px', minWidth: '50px', textAlign: 'right' } },
          { default: () => `${row.ratio.toFixed(1)}%` })
      ])
  }
]

const reviewerColumns = [
  { title: '复核人', key: 'reviewer' },
  { title: '贡献数', key: 'count', width: 100 }
]
</script>

<template>
  <NCard title="📊 批量统计报表" size="small" :bordered="false">
    <template v-if="report">
      <NSpace vertical style="width: 100%">
        <NSpace wrap justify="space-between" style="width: 100%">
          <NSpace>
            <NTag size="small" type="info" round>
              {{ report.schemeName }}
            </NTag>
            <NText depth="3" style="font-size: 11px">
              生成于 {{ formatLogTimestamp(report.generatedAt) }}
            </NText>
          </NSpace>
          <NSpace>
            <NButton size="tiny" @click="refreshReport">
              <template #icon><NIcon>🔄</NIcon></template>
              刷新
            </NButton>
            <NButton size="tiny" @click="exportCSV">
              <template #icon><NIcon>📄</NIcon></template>
              导出CSV
            </NButton>
            <NButton size="tiny" @click="exportJSON">
              <template #icon><NIcon>📋</NIcon></template>
              导出JSON
            </NButton>
          </NSpace>
        </NSpace>

        <NGrid :cols="3" x-gap="12" y-gap="12">
          <NGridItem>
            <NStatistic label="区域总数" :value="report.totalRegions" />
          </NGridItem>
          <NGridItem>
            <NStatistic
              label="平均置信度"
              :value="report.averageConfidence"
              suffix="%"
            />
          </NGridItem>
          <NGridItem>
            <NStatistic
              label="冲突总数"
              :value="report.conflictCount"
            />
          </NGridItem>
          <NGridItem>
            <NStatistic label="自动采纳数" :value="report.autoAcceptedCount" />
          </NGridItem>
          <NGridItem>
            <NStatistic label="人工复核数" :value="report.manualReviewedCount" />
          </NGridItem>
          <NGridItem>
            <NStatistic
              label="已解决冲突"
              :value="report.resolvedConflictCount"
            />
          </NGridItem>
        </NGrid>

        <NText depth="3" style="font-size: 12px; font-weight: bold">📂 按类别统计</NText>
        <NDataTable
          :columns="categoryColumns"
          :data="categoryTableData"
          :single-line="false"
          size="small"
          :bordered="false"
          :pagination="false"
          :row-props="(row) => ({
            style: { borderLeft: `4px solid ${row.color}` }
          })"
        />

        <NText depth="3" style="font-size: 12px; font-weight: bold">📌 按状态统计</NText>
        <NDataTable
          :columns="statusColumns"
          :data="statusTableData"
          :single-line="false"
          size="small"
          :bordered="false"
          :pagination="false"
        />

        <template v-if="reviewerTableData.length > 0">
          <NText depth="3" style="font-size: 12px; font-weight: bold">👥 复核人贡献</NText>
          <NDataTable
            :columns="reviewerColumns"
            :data="reviewerTableData"
            :single-line="false"
            size="small"
            :bordered="false"
            :pagination="false"
          />
        </template>
      </NSpace>
    </template>
    <NEmpty v-else description="创建方案后可查看批量统计报表" size="small" />
  </NCard>
</template>
