<script setup lang="ts">
import { computed, h } from 'vue'
import { useMainStore } from '@/stores/main'
import {
  NCard,
  NGrid,
  NGridItem,
  NStatistic,
  NDataTable,
  NProgress,
  NText,
  NTag,
  NEmpty
} from 'naive-ui'
import { RegionCategoryLabel, RegionCategoryColor } from '@/types'

const store = useMainStore()

const stats = computed(() => store.currentStats)

const pageArea = computed(() => {
  if (!store.pageImage) return 0
  return store.pageImage.width * store.pageImage.height
})

const tableData = computed(() => {
  if (!stats.value) return []
  return stats.value.statsByCategory.map((s) => ({
    key: s.category,
    category: RegionCategoryLabel[s.category],
    count: s.count,
    area: Math.round(s.area),
    ratio: s.areaRatio,
    color: RegionCategoryColor[s.category]
  }))
})

const columns = [
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
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        [
          h(NProgress, {
            type: 'line',
            percentage: Math.round(row.ratio * 100) / 100,
            color: row.color,
            railStyle: { background: '#f0f0f0' },
            style: { flex: '1', maxWidth: '120px' }
          }),
          h(
            NText,
            { depth: 2, style: { fontSize: '12px', minWidth: '56px', textAlign: 'right' } },
            { default: () => `${row.ratio.toFixed(2)}%` }
          )
        ]
      )
  }
]
</script>

<template>
  <NCard title="统计分析" size="small" :bordered="false">
    <template v-if="stats && pageArea > 0">
      <NGrid :cols="2" x-gap="12" y-gap="12" style="margin-bottom: 16px">
        <NGridItem>
          <NStatistic label="区域总数" :value="stats.totalRegions" />
        </NGridItem>
        <NGridItem>
          <NStatistic label="可见区域" :value="stats.visibleRegions" />
        </NGridItem>
        <NGridItem>
          <NStatistic
            label="页面总像素"
            :value="pageArea"
            :format-value="(v) => Number(v).toLocaleString()"
          />
        </NGridItem>
        <NGridItem>
          <NStatistic
            label="标注面积占比"
            :value="Math.round((stats.visibleArea / pageArea) * 10000) / 100"
            suffix="%"
          />
        </NGridItem>
      </NGrid>

      <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 8px">
        <NTag size="small" type="info" round>面积统计已排除隐藏区域</NTag>
      </NText>

      <NDataTable
        :columns="columns"
        :data="tableData"
        :single-line="false"
        size="small"
        :bordered="false"
        :pagination="false"
        :row-props="(row) => ({
          style: { borderLeft: `4px solid ${row.color}` }
        })"
      />
    </template>
    <NEmpty v-else description="上传图像并创建方案后查看统计" size="small" />
  </NCard>
</template>
