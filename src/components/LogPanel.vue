<script setup lang="ts">
import { computed, ref } from 'vue'
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
  NSelect,
  NInput
} from 'naive-ui'
import { exportLogsAsText, formatLogTimestamp } from '@/utils/reviewUtils'

const store = useMainStore()
const message = useMessage()

const filterAction = ref<string | null>(null)
const filterReviewer = ref<string | null>(null)

const actionOptions = computed(() => {
  const actions = new Set(store.currentSchemeLogs.map(l => l.action))
  return Array.from(actions).map(a => ({ label: a, value: a }))
})

const reviewerOptions = computed(() => {
  const reviewers = new Set(store.currentSchemeLogs.map(l => l.reviewer))
  return Array.from(reviewers).map(r => ({ label: r, value: r }))
})

const filteredLogs = computed(() => {
  return store.currentSchemeLogs.filter(log => {
    if (filterAction.value && log.action !== filterAction.value) return false
    if (filterReviewer.value && log.reviewer !== filterReviewer.value) return false
    return true
  })
})

function handleExport() {
  const text = exportLogsAsText(filteredLogs.value)
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `复核日志_${new Date().toISOString().slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
  message.success('日志已导出')
}
</script>

<template>
  <NCard title="📋 复核日志" size="small" :bordered="false">
    <NSpace vertical style="width: 100%">
      <NSpace wrap justify="space-between" style="width: 100%">
        <NSpace wrap>
          <NSelect
          v-model:value="filterAction"
          placeholder="筛选操作"
          clearable
          :options="actionOptions"
          size="small"
          style="width: 140px"
        />
        <NSelect
          v-model:value="filterReviewer"
          placeholder="筛选操作人"
          clearable
          :options="reviewerOptions"
          size="small"
          style="width: 120px"
        />
        </NSpace>
        <NButton
          size="small"
          :disabled="filteredLogs.length === 0"
          @click="handleExport"
        >
          <template #icon><NIcon>📥</NIcon></template>
          导出日志
        </NButton>
      </NSpace>

      <template v-if="filteredLogs.length > 0">
        <NText depth="3" style="font-size: 12px">
          共 {{ filteredLogs.length }} 条记录
        </NText>
        <div style="border: 1px solid #eee; border-radius: 6px; max-height: 300px; overflow: auto">
          <NList bordered size="small" style="border: none">
            <NListItem
              v-for="log in filteredLogs"
              :key="log.id"
              style="padding: 8px 10px"
            >
              <div style="width: 100%">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px; flex-wrap: wrap">
                  <NText depth="3" style="font-size: 11px">
                    {{ formatLogTimestamp(log.timestamp) }}
                  </NText>
                  <NTag size="tiny" type="info" round>
                    {{ log.reviewer }}
                  </NTag>
                  <NTag size="tiny" bordered round>
                    {{ log.action }}
                  </NTag>
                </div>
                <NText style="font-size: 12px">
                  {{ log.details }}
                </NText>
              </div>
            </NListItem>
          </NList>
        </div>
      </template>

      <NEmpty v-else description="暂无操作日志" size="small" />
    </NSpace>
  </NCard>
</template>
