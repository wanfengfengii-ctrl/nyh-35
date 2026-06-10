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
  NAvatar,
  NSelect,
  NInputNumber,
  NDivider,
  NSwitch
} from 'naive-ui'
import {
  RegionCategoryLabel,
  RegionCategoryColor,
  ReviewDecision,
  ReviewDecisionLabel,
  ReviewOpinion,
  RegionStatus,
  RegionStatusLabel,
  RegionCategory,
  Region
} from '@/types'

const store = useMainStore()
const message = useMessage()
const dialog = useDialog()

const selectedRegionForReview = ref<string | null>(null)
const reviewDecision = ref<ReviewDecision>(ReviewDecision.APPROVE)
const reviewComment = ref('')
const showModifyForm = ref(false)

const proposedName = ref('')
const proposedCategory = ref<RegionCategory>(RegionCategory.MAIN_TEXT)
const proposedOrder = ref(1)
const proposedDescription = ref('')
const proposedX = ref(0)
const proposedY = ref(0)
const proposedWidth = ref(0)
const proposedHeight = ref(0)
const modifyName = ref(false)
const modifyCategory = ref(false)
const modifyOrder = ref(false)
const modifyDescription = ref(false)
const modifyPosition = ref(false)

const decisionTagType: Record<ReviewDecision, 'success' | 'error' | 'warning' | 'default'> = {
  [ReviewDecision.APPROVE]: 'success',
  [ReviewDecision.REJECT]: 'error',
  [ReviewDecision.MODIFY]: 'warning',
  [ReviewDecision.PENDING]: 'default'
}

const categoryOptions = computed(() =>
  Object.values(RegionCategory).map((c) => ({
    label: RegionCategoryLabel[c],
    value: c
  }))
)

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
  showModifyForm.value = false
  resetModifyForm()
}

function resetModifyForm() {
  if (!store.selectedRegion) return
  const r = store.selectedRegion
  proposedName.value = r.name
  proposedCategory.value = r.category
  proposedOrder.value = r.order
  proposedDescription.value = r.description
  proposedX.value = Math.round(r.position.x)
  proposedY.value = Math.round(r.position.y)
  proposedWidth.value = Math.round(r.position.width)
  proposedHeight.value = Math.round(r.position.height)
  modifyName.value = false
  modifyCategory.value = false
  modifyOrder.value = false
  modifyDescription.value = false
  modifyPosition.value = false
}

function getProposedChanges(): Partial<Region> | null {
  if (!modifyName.value && !modifyCategory.value && !modifyOrder.value && !modifyDescription.value && !modifyPosition.value) {
    return null
  }
  const changes: Partial<Region> = {}
  if (modifyName.value) changes.name = proposedName.value
  if (modifyCategory.value) changes.category = proposedCategory.value
  if (modifyOrder.value) changes.order = proposedOrder.value
  if (modifyDescription.value) changes.description = proposedDescription.value
  if (modifyPosition.value) {
    changes.position = {
      x: proposedX.value,
      y: proposedY.value,
      width: proposedWidth.value,
      height: proposedHeight.value
    }
  }
  return changes
}

function submitReview() {
  if (!selectedRegionForReview.value) {
    message.warning('请先选择一个区域')
    return
  }
  const proposedChanges = getProposedChanges()
  if (reviewDecision.value === ReviewDecision.MODIFY && !proposedChanges && reviewComment.value.trim() === '') {
    message.warning('请填写修改建议或评论内容')
    return
  }
  const result = store.addReviewOpinion(
    selectedRegionForReview.value,
    reviewDecision.value,
    reviewComment.value.trim(),
    proposedChanges
  )
  if (result.valid) {
    message.success('复核意见已提交')
    reviewComment.value = ''
    showModifyForm.value = false
    resetModifyForm()
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

          <div
            style="margin-bottom: 8px; padding: 8px; border: 1px dashed #d9d9d9; border-radius: 4px; background: #fafafa"
          >
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px">
              <NText depth="3" style="font-size: 12px; font-weight: bold">
                ✏️ 具体修改建议
              </NText>
              <NSwitch
                v-model:value="showModifyForm"
                round
                size="small"
              />
            </div>

            <template v-if="showModifyForm">
              <NDivider style="margin: 6px 0" />

              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px">
                <NSwitch v-model:value="modifyName" size="small" />
                <NText depth="3" style="font-size: 12px">名称:</NText>
                <NInput
                  v-model:value="proposedName"
                  size="small"
                  :disabled="!modifyName"
                  style="flex: 1; min-width: 0"
                />
              </div>

              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px">
                <NSwitch v-model:value="modifyCategory" size="small" />
                <NText depth="3" style="font-size: 12px">类别:</NText>
                <NSelect
                  v-model:value="proposedCategory"
                  :options="categoryOptions"
                  size="small"
                  :disabled="!modifyCategory"
                  style="flex: 1; min-width: 0"
                />
              </div>

              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px">
                <NSwitch v-model:value="modifyOrder" size="small" />
                <NText depth="3" style="font-size: 12px">顺序:</NText>
                <NInputNumber
                  v-model:value="proposedOrder"
                  size="small"
                  :min="1"
                  :disabled="!modifyOrder"
                  style="width: 100px"
                />
              </div>

              <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px">
                <NSwitch v-model:value="modifyDescription" size="small" style="margin-top: 4px" />
                <NText depth="3" style="font-size: 12px; margin-top: 4px">描述:</NText>
                <NInput
                  v-model:value="proposedDescription"
                  type="textarea"
                  size="small"
                  :rows="2"
                  :disabled="!modifyDescription"
                  style="flex: 1; min-width: 0"
                />
              </div>

              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px">
                <NSwitch v-model:value="modifyPosition" size="small" />
                <NText depth="3" style="font-size: 12px">位置尺寸:</NText>
              </div>
              <div v-if="modifyPosition" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding-left: 24px; margin-bottom: 6px">
                <div style="display: flex; align-items: center; gap: 4px">
                  <NText depth="3" style="font-size: 11px">X:</NText>
                  <NInputNumber v-model:value="proposedX" size="small" style="width: 100%" />
                </div>
                <div style="display: flex; align-items: center; gap: 4px">
                  <NText depth="3" style="font-size: 11px">Y:</NText>
                  <NInputNumber v-model:value="proposedY" size="small" style="width: 100%" />
                </div>
                <div style="display: flex; align-items: center; gap: 4px">
                  <NText depth="3" style="font-size: 11px">宽:</NText>
                  <NInputNumber v-model:value="proposedWidth" size="small" style="width: 100%" />
                </div>
                <div style="display: flex; align-items: center; gap: 4px">
                  <NText depth="3" style="font-size: 11px">高:</NText>
                  <NInputNumber v-model:value="proposedHeight" size="small" style="width: 100%" />
                </div>
              </div>

              <NText depth="3" style="font-size: 11px; font-style: italic">
                打开开关的字段才会作为修改建议提交
              </NText>
            </template>
          </div>

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
                  <div
                    style="margin-top: 6px; padding: 6px; background: #fff7e6; border: 1px dashed #ffd591; border-radius: 4px"
                  >
                    <NText depth="3" style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 4px">
                      📝 修改建议：
                    </NText>
                    <div style="font-size: 11px; line-height: 1.6">
                      <template v-if="op.proposedChanges.name">
                        <div>• 名称 → {{ op.proposedChanges.name }}</div>
                      </template>
                      <template v-if="op.proposedChanges.category">
                        <div>• 类别 → {{ RegionCategoryLabel[op.proposedChanges.category as RegionCategory] }}</div>
                      </template>
                      <template v-if="op.proposedChanges.order !== undefined">
                        <div>• 顺序 → {{ op.proposedChanges.order }}</div>
                      </template>
                      <template v-if="op.proposedChanges.description">
                        <div>• 描述 → {{ op.proposedChanges.description }}</div>
                      </template>
                      <template v-if="op.proposedChanges.position">
                        <div>
                          • 位置尺寸 → ({{ Math.round(op.proposedChanges.position.x) }}, {{ Math.round(op.proposedChanges.position.y) }})
                          {{ Math.round(op.proposedChanges.position.width) }}×{{ Math.round(op.proposedChanges.position.height) }}
                        </div>
                      </template>
                    </div>
                    <div style="margin-top: 6px">
                      <NButton
                        size="tiny"
                        type="warning"
                        @click="handleApplyOpinion(op)"
                      >
                        应用此修改建议
                      </NButton>
                    </div>
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
