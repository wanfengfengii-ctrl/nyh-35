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
  useDialog,
  NRadio,
  NRadioGroup,
  NInput,
  NBadge,
  NTooltip,
  NAvatar
} from 'naive-ui'
import {
  RegionCategoryLabel,
  RegionCategoryColor,
  ReviewDecision,
  ReviewDecisionLabel,
  ReviewOpinion,
  RegionStatus,
  RegionStatusLabel
} from '@/types'

const store = useMainStore()
const message = useMessage()
const dialog = useDialog()

const selectedRegionForReview = ref<string | null>(null)
const reviewDecision = ref<ReviewDecision>(ReviewDecision.APPROVE)
const reviewComment = ref('')

const decisionTagType: Record<ReviewDecision, 'success' | 'error' | 'warning' | 'default'> = {
  [ReviewDecision.APPROVE]: 'success',
  [ReviewDecision.REJECT]: 'error',
  [ReviewDecision.MODIFY]: 'warning',
  [ReviewDecision.PENDING]: 'default'
}

const regionsNeedingReview = computed(() =>
  store.regions.filter(r =>
    r.status === RegionStatus.PENDING ||
    r.status === RegionStatus.IN_PROGRESS
  )
)

const reviewedRegions = computed(() =>
  store.regions.filter(r =>
    r.status === RegionStatus.REVIEWED ||
    r.status === RegionStatus.FINALIZED
  )
)

function selectForReview(regionId: string) {
  selectedRegionForReview.value = regionId
  store.selectRegion(regionId)
  reviewDecision.value = ReviewDecision.APPROVE
  reviewComment.value = ''
}

function submitReview() {
  if (!selectedRegionForReview.value) {
    message.warning('请先选择一个区域')
    return
  }
  const result = store.addReviewOpinion(
    selectedRegionForReview.value,
    reviewDecision.value,
    reviewComment.value.trim()
  )
  if (result.valid) {
    message.success('复核意见已提交')
    reviewComment.value = ''
  } else {
    message.error(result.message)
  }
}

function handleApplyOpinion(opinion: ReviewOpinion) {
  if (!opinion.proposedChanges) return
  const result = store.applyOpinionChanges(opinion.id)
  if (result.valid) {
    message.success('修改建议已应用')
  } else {
    message.error(result.message)
  }
}

function handleFinalize(regionId: string, regionName: string) {
  dialog.warning({
    title: '定稿确认',
    content: `确定要将区域「${regionName}」标记为已定稿吗？定稿后表示复核完成。`,
    positiveText: '确认定稿',
    negativeText: '取消',
    onPositiveClick: () => {
      const result = store.finalizeRegion(regionId)
      if (result.valid) {
        message.success('已标记为定稿')
      }
    }
  })
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <NCard title="👥 协同复核" size="small" :bordered="false">
    <NSpace vertical style="width: 100%">
      <NSpace wrap>
        <NTag size="small" type="info" round>
          待复核: {{ regionsNeedingReview.length }}
        </NTag>
        <NTag size="small" type="success" round>
          已复核: {{ reviewedRegions.length }}
        </NTag>
        <NTag size="small" type="warning" round v-if="store.currentSchemeOpinions.length > 0">
          意见总数: {{ store.currentSchemeOpinions.length }}
        </NTag>
      </NSpace>

      <template v-if="store.selectedRegion">
        <div
          style="padding: 10px; border: 1px solid #e6f7ff; border-radius: 6px; background: #f0faff"
        >
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
            <NTag :color="RegionCategoryColor[store.selectedRegion.category]" size="small" round>
              {{ RegionCategoryLabel[store.selectedRegion.category] }}
            </NTag>
            <NText strong>{{ store.selectedRegion.name }}</NText>
            <NTag size="small" round>
              {{ RegionStatusLabel[store.selectedRegion.status] }}
            </NTag>
          </div>

          <div style="margin-bottom: 8px">
            <NText depth="3" style="font-size: 12px">选择复核结论：</NText>
            <NRadioGroup v-model:value="reviewDecision" style="margin-top: 4px">
              <NSpace>
                <NRadio :value="ReviewDecision.APPROVE">
                  <NTag size="small" type="success" round>通过</NTag>
                </NRadio>
                <NRadio :value="ReviewDecision.MODIFY">
                  <NTag size="small" type="warning" round>需修改</NTag>
                </NRadio>
                <NRadio :value="ReviewDecision.REJECT">
                  <NTag size="small" type="error" round>驳回</NTag>
                </NRadio>
              </NSpace>
            </NRadioGroup>
          </div>

          <NInput
            v-model:value="reviewComment"
            type="textarea"
            :rows="2"
            placeholder="输入复核意见和备注..."
            style="margin-bottom: 8px"
          />

          <NSpace>
            <NButton
              size="small"
              type="primary"
              @click="submitReview"
            >
              <template #icon><NIcon>📝</NIcon></template>
              提交复核意见
            </NButton>
            <NButton
              size="small"
              type="success"
              :disabled="store.getRegionMergedDecision(store.selectedRegion.id) !== ReviewDecision.APPROVE"
              @click="handleFinalize(store.selectedRegion!.id, store.selectedRegion!.name)"
            >
              <template #icon><NIcon>📌</NIcon></template>
              标记定稿
            </NButton>
          </NSpace>

          <template v-if="store.getRegionOpinions(store.selectedRegion.id).length > 0">
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #eee">
              <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 6px">
                历史复核意见（{{ store.getRegionOpinions(store.selectedRegion.id).length }}条）：
              </NText>
              <div
                v-for="op in store.getRegionOpinions(store.selectedRegion.id)"
                :key="op.id"
                style="padding: 6px 8px; margin-bottom: 4px; background: #fff; border-radius: 4px; border: 1px solid #f0f0f0"
              >
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px">
                  <NSpace align="center">
                    <NAvatar size="small" round>{{ op.reviewer.charAt(0) }}</NAvatar>
                    <NText strong style="font-size: 12px">{{ op.reviewer }}</NText>
                    <NTag size="tiny" :type="decisionTagType[op.decision]" round>
                      {{ ReviewDecisionLabel[op.decision] }}
                    </NTag>
                  </NSpace>
                  <NText depth="3" style="font-size: 11px">{{ formatTime(op.createdAt) }}</NText>
                </div>
                <NText v-if="op.comment" style="font-size: 12px" depth="2">
                  {{ op.comment }}
                </NText>
                <template v-if="op.proposedChanges">
                  <div style="margin-top: 4px">
                    <NButton
                      quaternary
                      size="tiny"
                      type="info"
                      @click="handleApplyOpinion(op)"
                    >
                      应用修改建议
                    </NButton>
                  </div>
                </template>
              </div>
            </div>
          </template>
        </div>
      </template>

      <template v-if="regionsNeedingReview.length > 0">
        <NText depth="3" style="font-size: 12px; font-weight: bold">📋 待复核区域：</NText>
        <div style="border: 1px solid #eee; border-radius: 6px; max-height: 180px; overflow: auto">
          <NList bordered size="small" style="border: none">
            <NListItem
              v-for="r in regionsNeedingReview"
              :key="r.id"
              style="padding: 8px 10px; cursor: pointer"
              :style="{
                background: store.selectedRegionId === r.id ? '#e6f7ff' : 'transparent'
              }"
              @click="selectForReview(r.id)"
            >
              <div style="display: flex; align-items: center; justify-content: space-between; width: 100%">
                <NSpace align="center">
                  <NBadge :value="r.order" :max="999">
                    <NTag :color="RegionCategoryColor[r.category]" size="small" round>
                      {{ RegionCategoryLabel[r.category].charAt(0) }}
                    </NTag>
                  </NBadge>
                  <NText strong style="font-size: 13px">{{ r.name }}</NText>
                  <NTag size="tiny" round>
                    {{ RegionStatusLabel[r.status] }}
                  </NTag>
                </NSpace>
                <template v-if="store.getRegionOpinions(r.id).length > 0">
                  <NTooltip trigger="hover">
                    <template #trigger>
                      <NTag size="tiny" type="info" round>
                        {{ store.getRegionOpinions(r.id).length }}条意见
                      </NTag>
                    </template>
                    综合结论：{{ ReviewDecisionLabel[store.getRegionMergedDecision(r.id)] }}
                  </NTooltip>
                </template>
              </div>
            </NListItem>
          </NList>
        </div>
      </template>

      <template v-if="reviewedRegions.length > 0">
        <NText depth="3" style="font-size: 12px; font-weight: bold">✅ 已完成复核：</NText>
        <div style="border: 1px solid #eee; border-radius: 6px; max-height: 140px; overflow: auto">
          <NList bordered size="small" style="border: none">
            <NListItem
              v-for="r in reviewedRegions"
              :key="r.id"
              style="padding: 8px 10px; cursor: pointer"
              :style="{
                background: store.selectedRegionId === r.id ? '#e6f7ff' : 'transparent'
              }"
              @click="selectForReview(r.id)"
            >
              <div style="display: flex; align-items: center; justify-content: space-between; width: 100%">
                <NSpace align="center">
                  <NTag :color="RegionCategoryColor[r.category]" size="small" round>
                    {{ RegionCategoryLabel[r.category].charAt(0) }}
                  </NTag>
                  <NText style="font-size: 13px">{{ r.name }}</NText>
                </NSpace>
                <NTag
                  size="tiny"
                  :type="r.status === RegionStatus.FINALIZED ? 'success' : 'warning'"
                  round
                >
                  {{ RegionStatusLabel[r.status] }}
                </NTag>
              </div>
            </NListItem>
          </NList>
        </div>
      </template>

      <NEmpty v-if="store.regions.length === 0" description="暂无区域可复核" size="small" />
    </NSpace>
  </NCard>
</template>
