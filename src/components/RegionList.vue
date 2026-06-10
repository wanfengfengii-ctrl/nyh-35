<script setup lang="ts">
import { computed } from 'vue'
import { useMainStore } from '@/stores/main'
import {
  NCard,
  NTag,
  NText,
  NBadge,
  NButton,
  NIcon,
  NEllipsis,
  useDialog,
  useMessage
} from 'naive-ui'
import {
  RegionCategoryLabel,
  RegionCategoryColor,
  RegionStatusLabel,
  RegionStatus
} from '@/types'

const store = useMainStore()
const dialog = useDialog()
const message = useMessage()

const regions = computed(() => store.sortedRegions)

const statusTagType: Record<RegionStatus, 'default' | 'info' | 'warning' | 'success'> = {
  [RegionStatus.PENDING]: 'default',
  [RegionStatus.IN_PROGRESS]: 'info',
  [RegionStatus.REVIEWED]: 'warning',
  [RegionStatus.FINALIZED]: 'success'
}

function handleSelect(id: string) {
  store.selectRegion(id)
}

function handleDelete(id: string, name: string, ev: Event) {
  ev.stopPropagation()
  const hasDesc = store.regionHasDescription(id)
  const doDelete = () => {
    const result = store.deleteRegion(id)
    if (result.valid) {
      message.success('区域已删除')
    } else {
      message.error(result.message)
    }
  }
  if (hasDesc) {
    dialog.warning({
      title: '二次确认',
      content: `区域「${name}」已填写说明，确定要删除吗？此操作不可撤销。`,
      positiveText: '确认删除',
      negativeText: '取消',
      onPositiveClick: doDelete
    })
  } else {
    doDelete()
  }
}

function toggleHidden(id: string, ev: Event) {
  ev.stopPropagation()
  const r = store.regions.find((x) => x.id === id)
  if (r) {
    store.updateRegion(id, { hidden: !r.hidden })
  }
}
</script>

<template>
  <NCard title="区域列表" size="small" :bordered="false">
    <template v-if="regions.length > 0">
      <div
        style="border: 1px solid #eee; border-radius: 6px; max-height: 450px; overflow: auto"
      >
        <div
          v-for="r in regions"
          :key="r.id"
          style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer; display: flex; gap: 10px; transition: background 0.15s"
          :style="{
            background: store.selectedRegionId === r.id ? '#e6f7ff' : 'transparent'
          }"
          @click="handleSelect(r.id)"
        >
          <div style="flex-shrink: 0">
            <NBadge :value="r.order" :max="999" :show-zero="false">
              <div
                style="width: 38px; height: 38px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #fff; font-weight: bold"
                :style="{ background: RegionCategoryColor[r.category] }"
              >
                {{ RegionCategoryLabel[r.category].charAt(0) }}
              </div>
            </NBadge>
          </div>
          <div style="flex: 1; min-width: 0">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px">
              <NText strong>{{ r.name }}</NText>
              <NTag
                size="small"
                :color="RegionCategoryColor[r.category]"
                round
                v-if="!r.hidden"
              >
                {{ RegionCategoryLabel[r.category] }}
              </NTag>
              <NTag v-else size="small" type="default" bordered round dashed>
                已隐藏
              </NTag>
              <NTag size="small" :type="statusTagType[r.status]" round>
                {{ RegionStatusLabel[r.status] }}
              </NTag>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <NEllipsis :line-clamp="1" style="flex: 1">
                <NText depth="3" style="font-size: 12px">
                  {{ r.description || '（无批注）' }}
                </NText>
              </NEllipsis>
              <div style="display: flex; gap: 4px; margin-left: 8px; flex-shrink: 0">
                <NButton quaternary size="tiny" @click="toggleHidden(r.id, $event)">
                  <NIcon :size="16">{{ r.hidden ? '👁' : '🙈' }}</NIcon>
                </NButton>
                <NButton quaternary type="error" size="tiny" @click="handleDelete(r.id, r.name, $event)">
                  <NIcon :size="16">🗑</NIcon>
                </NButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <div v-else style="text-align: center; padding: 24px 0; color: #999">
      <NText depth="3">暂无区域，请在画布上绘制</NText>
    </div>
  </NCard>
</template>
