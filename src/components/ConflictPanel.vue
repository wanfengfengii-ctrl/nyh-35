<script setup lang="ts">
import { computed } from 'vue'
import { useMainStore } from '@/stores/main'
import {
  NCard,
  NButton,
  NSpace,
  NTag,
  NText,
  NIcon,
  NList,
  NListItem,
  NEmpty,
  useMessage,
  NBadge,
  NTooltip
} from 'naive-ui'
import { ConflictInfo } from '@/types'

const store = useMainStore()
const message = useMessage()

const severityLabel: Record<'low' | 'medium' | 'high', string> = {
  low: '低',
  medium: '中',
  high: '高'
}

const severityColor: Record<'low' | 'medium' | 'high', string> = {
  low: '#52c41a',
  medium: '#faad14',
  high: '#ff4d4f'
}

const typeLabel: Record<string, string> = {
  overlap: '区域重叠',
  category_mismatch: '类别冲突',
  order_conflict: '顺序冲突',
  boundary_deviation: '边界偏差'
}

const sortedConflicts = computed(() => {
  const order = { high: 0, medium: 1, low: 2 }
  return [...store.conflicts].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1
    return order[a.severity] - order[b.severity]
  })
})

function handleResolve(conflict: ConflictInfo) {
  const result = store.resolveConflict(conflict.id)
  if (result.valid) {
    message.success('冲突已标记为已解决')
  }
}

function handleRefresh() {
  store.refreshConflicts()
  message.success(`检测完成，发现 ${store.conflicts.length} 个冲突`)
}

function locateConflictRegion(regionId: string) {
  store.selectRegion(regionId)
}
</script>

<template>
  <NCard title="⚠️ 冲突检测" size="small" :bordered="false">
    <NSpace vertical style="width: 100%">
      <NSpace wrap justify="space-between" style="width: 100%">
        <NSpace>
          <NBadge
            v-if="store.unresolvedConflicts.length > 0"
            :value="store.unresolvedConflicts.length"
            type="error"
            :show-zero="true"
          >
            <NTag size="small" type="error" round>
              未解决
            </NTag>
          </NBadge>
          <NTag v-else size="small" type="success" round>
            无冲突
          </NTag>
          <NTag size="small" type="default" bordered round v-if="store.conflicts.length > 0">
            总计 {{ store.conflicts.length }}
          </NTag>
        </NSpace>
        <NButton size="tiny" @click="handleRefresh">
          <template #icon><NIcon>🔄</NIcon></template>
          重新检测
        </NButton>
      </NSpace>

      <template v-if="sortedConflicts.length > 0">
        <div style="border: 1px solid #eee; border-radius: 6px; max-height: 300px; overflow: auto">
          <NList bordered size="small" style="border: none">
            <NListItem
              v-for="c in sortedConflicts"
              :key="c.id"
              style="padding: 10px 12px"
              :style="{
                opacity: c.resolved ? 0.5 : 1
              }"
            >
              <div style="width: 100%">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap">
                  <NTag
                    size="small"
                    round
                    :style="{ background: severityColor[c.severity] + '22', color: severityColor[c.severity], borderColor: severityColor[c.severity] }"
                  >
                    {{ severityLabel[c.severity] }}级
                  </NTag>
                  <NTag size="small" bordered round>
                    {{ typeLabel[c.type] || c.type }}
                  </NTag>
                  <NTag v-if="c.resolved" size="small" type="success" round>
                    已解决
                  </NTag>
                </div>
                <NText style="font-size: 13px">{{ c.description }}</NText>
                <div style="margin-top: 6px">
                  <NSpace wrap>
                    <NTooltip
                      v-for="rid in c.regionIds"
                      :key="rid"
                      trigger="hover"
                    >
                      <template #trigger>
                        <NButton
                          size="tiny"
                          text
                          type="info"
                          @click="locateConflictRegion(rid)"
                        >
                          定位区域
                        </NButton>
                      </template>
                      点击在画布上定位并选中该区域
                    </NTooltip>
                    <NButton
                      v-if="!c.resolved"
                      size="tiny"
                      type="success"
                      quaternary
                      @click="handleResolve(c)"
                    >
                      标记已解决
                    </NButton>
                  </NSpace>
                </div>
              </div>
            </NListItem>
          </NList>
        </div>
      </template>

      <NEmpty v-else description="暂无冲突，布局良好 👍" size="small" />
    </NSpace>
  </NCard>
</template>
