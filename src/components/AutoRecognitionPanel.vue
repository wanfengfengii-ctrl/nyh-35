<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMainStore } from '@/stores/main'
import {
  NCard,
  NButton,
  NSpace,
  NTag,
  NText,
  NProgress,
  NIcon,
  NList,
  NListItem,
  NEmpty,
  useMessage,
  useDialog,
  NInputNumber,
  NSwitch,
  NBadge,
  NTooltip,
  NModal,
  NInput
} from 'naive-ui'
import {
  RegionCategoryLabel,
  RegionCategoryColor,
  CandidateStatus,
  CandidateStatusLabel,
  CandidateRegion
} from '@/types'

const store = useMainStore()
const message = useMessage()
const dialog = useDialog()

const showTemplateModal = ref(false)

const pendingCandidatesWithStatus = computed(() => {
  return store.candidates
    .filter(c => store.showCandidates || c.status === CandidateStatus.PENDING)
    .sort((a, b) => {
      if (a.status !== b.status) {
        const order = { [CandidateStatus.PENDING]: 0, [CandidateStatus.ACCEPTED]: 1, [CandidateStatus.REJECTED]: 2, [CandidateStatus.MODIFIED]: 3 }
        return order[a.status] - order[b.status]
      }
      return b.confidence - a.confidence
    })
})

const statusTagType: Record<CandidateStatus, 'default' | 'success' | 'error' | 'warning'> = {
  [CandidateStatus.PENDING]: 'default',
  [CandidateStatus.ACCEPTED]: 'success',
  [CandidateStatus.REJECTED]: 'error',
  [CandidateStatus.MODIFIED]: 'warning'
}

function handleRunRecognition() {
  const result = store.runAutoRecognition()
  if (result.valid) {
    message.success(result.message)
  } else {
    message.warning(result.message)
  }
}

function handleAccept(candidate: CandidateRegion) {
  const result = store.acceptCandidate(candidate.id)
  if (result.valid) {
    message.success(`已采纳「${candidate.templateName}」`)
  } else {
    message.error(result.message)
  }
}

function handleReject(candidate: CandidateRegion) {
  const result = store.rejectCandidate(candidate.id)
  if (result.valid) {
    message.success(`已拒绝「${candidate.templateName}」`)
  }
}

function handleAcceptAll() {
  if (store.pendingCandidates.length === 0) {
    message.warning('暂无可采纳的候选区域')
    return
  }
  dialog.warning({
    title: '批量采纳确认',
    content: `将采纳所有置信度 ≥ ${store.confidenceThreshold}% 的候选区域（共 ${store.pendingCandidates.filter(c => c.confidence >= store.confidenceThreshold).length} 个），确定继续？`,
    positiveText: '确认采纳',
    negativeText: '取消',
    onPositiveClick: () => {
      const { accepted, total } = store.acceptAllCandidates()
      message.success(`已采纳 ${accepted}/${total} 个候选区域`)
    }
  })
}

function handleRejectAll() {
  if (store.pendingCandidates.length === 0) {
    message.warning('暂无可拒绝的候选区域')
    return
  }
  dialog.warning({
    title: '批量拒绝确认',
    content: `将拒绝所有待处理的候选区域（共 ${store.pendingCandidates.length} 个），确定继续？`,
    positiveText: '确认拒绝',
    negativeText: '取消',
    onPositiveClick: () => {
      const count = store.rejectAllCandidates()
      message.success(`已拒绝 ${count} 个候选区域`)
    }
  })
}

function handleSaveTemplate(regionId: string) {
  const result = store.saveTemplateFromRegion(regionId)
  if (result.valid) {
    message.success(result.message)
  } else {
    message.warning(result.message)
  }
}
</script>

<template>
  <NCard title="🤖 半自动识别" size="small" :bordered="false">
    <NSpace vertical style="width: 100%">
      <NSpace wrap>
        <NButton
          type="primary"
          size="small"
          :disabled="!store.pageImage"
          @click="handleRunRecognition"
        >
          <template #icon><NIcon>🔍</NIcon></template>
          运行自动识别
        </NButton>
        <NButton
          size="small"
          type="success"
          :disabled="store.pendingCandidates.length === 0"
          @click="handleAcceptAll"
        >
          <template #icon><NIcon>✅</NIcon></template>
          一键采纳
        </NButton>
        <NButton
          size="small"
          type="warning"
          :disabled="store.pendingCandidates.length === 0"
          @click="handleRejectAll"
        >
          <template #icon><NIcon>❌</NIcon></template>
          全部拒绝
        </NButton>
      </NSpace>

      <NSpace align="center" wrap>
        <div style="display: flex; align-items: center; gap: 6px">
          <NText depth="3" style="font-size: 12px">置信度阈值:</NText>
          <NInputNumber
            v-model:value="store.confidenceThreshold"
            :min="0"
            :max="100"
            size="small"
            style="width: 80px"
            suffix="%"
          />
        </div>
        <div style="display: flex; align-items: center; gap: 6px">
          <NSwitch
            v-model:value="store.showCandidates"
            round
            size="small"
          />
          <NText depth="3" style="font-size: 12px">显示已处理</NText>
        </div>
      </NSpace>

      <template v-if="store.templates.length > 0">
        <NSpace vertical size="small">
          <NText depth="3" style="font-size: 12px">
            📚 已保存模板: {{ store.templates.length }} 个
          </NText>
          <div style="display: flex; flex-wrap: wrap; gap: 4px">
            <NTag
              v-for="t in store.templates.slice(0, 6)"
              :key="t.id"
              size="small"
              :color="RegionCategoryColor[t.category]"
              bordered
              round
            >
              {{ t.name }} ({{ t.usageCount }}次)
            </NTag>
            <NTag v-if="store.templates.length > 6" size="small" bordered round>
              +{{ store.templates.length - 6 }}
            </NTag>
          </div>
        </NSpace>
      </template>

      <template v-if="store.selectedRegion">
        <NButton
          size="small"
          type="info"
          @click="handleSaveTemplate(store.selectedRegion!.id)"
        >
          <template #icon><NIcon>💾</NIcon></template>
          将选中区域保存为模板
        </NButton>
      </template>

      <template v-if="store.candidates.length > 0">
        <div style="border: 1px solid #eee; border-radius: 6px; max-height: 380px; overflow: auto">
          <NList bordered size="small" style="border: none">
            <NListItem
              v-for="c in pendingCandidatesWithStatus"
              :key="c.id"
              style="padding: 10px 12px"
            >
              <div style="width: 100%">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px">
                  <NSpace align="center">
                    <NBadge
                      :value="`${c.confidence}%`"
                      :type="c.confidence >= 80 ? 'success' : c.confidence >= 60 ? 'warning' : 'error'"
                      :show-zero="true"
                      processing
                    >
                      <NTag
                        :color="RegionCategoryColor[c.category]"
                        size="small"
                        round
                      >
                        {{ RegionCategoryLabel[c.category] }}
                      </NTag>
                    </NBadge>
                    <NText strong style="font-size: 13px">{{ c.templateName }}</NText>
                  </NSpace>
                  <NTag
                    size="small"
                    :type="statusTagType[c.status]"
                    round
                  >
                    {{ CandidateStatusLabel[c.status] }}
                  </NTag>
                </div>

                <div style="margin-bottom: 6px">
                  <NProgress
                    type="line"
                    :percentage="c.confidence"
                    :color="c.confidence >= 80 ? '#52c41a' : c.confidence >= 60 ? '#faad14' : '#ff4d4f'"
                    rail-style="background: #f0f0f0"
                    style="height: 4px"
                  />
                </div>

                <NText depth="3" style="font-size: 11px; display: block; margin-bottom: 6px">
                  {{ c.suggestion }}
                </NText>

                <template v-if="c.status === CandidateStatus.PENDING">
                  <NSpace>
                    <NButton
                      quaternary
                      size="tiny"
                      type="success"
                      @click="handleAccept(c)"
                    >
                      采纳
                    </NButton>
                    <NButton
                      quaternary
                      size="tiny"
                      type="warning"
                      @click="handleReject(c)"
                    >
                      拒绝
                    </NButton>
                    <NTooltip trigger="hover">
                      <template #trigger>
                        <NText depth="3" style="font-size: 11px">
                          位置: ({{ Math.round(c.position.x) }}, {{ Math.round(c.position.y) }}) {{ Math.round(c.position.width) }}×{{ Math.round(c.position.height) }}
                        </NText>
                      </template>
                      区域位置与尺寸
                    </NTooltip>
                  </NSpace>
                </template>
              </div>
            </NListItem>
          </NList>
        </div>

        <NSpace justify="space-between" style="width: 100%">
          <NText depth="3" style="font-size: 12px">
            共 {{ store.candidates.length }} 个候选
            <template v-if="store.pendingCandidates.length > 0">
              · 待处理 {{ store.pendingCandidates.length }}
            </template>
            <template v-if="store.acceptedCandidates.length > 0">
              · 已采纳 {{ store.acceptedCandidates.length }}
            </template>
          </NText>
          <NButton text size="tiny" @click="store.clearCandidates">
            清空候选
          </NButton>
        </NSpace>
      </template>

      <NEmpty v-else description="点击「运行自动识别」基于已有模板生成候选区域" size="small" />
    </NSpace>
  </NCard>
</template>
