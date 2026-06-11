<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMainStore } from '@/stores/main'
import {
  RegionCategory,
  RegionCategoryLabel,
  RegionStatus,
  RegionStatusLabel,
  type Region
} from '@/types'
import type { TagType } from '@/utils/common'
import {
  NCard,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NButton,
  NText,
  NDivider,
  NTag
} from 'naive-ui'
import { useNotify, useDialog } from '@/utils/common'
import { calculateRegionArea } from '@/utils/statistics'

const store = useMainStore()
const notify = useNotify()
const dialog = useDialog()

const region = computed(() => store.selectedRegion)

const localName = ref('')
const localCategory = ref<RegionCategory>(RegionCategory.MAIN_TEXT)
const localOrder = ref(1)
const localDescription = ref('')
const localStatus = ref<RegionStatus>(RegionStatus.PENDING)
const localHidden = ref(false)
const localX = ref(0)
const localY = ref(0)
const localWidth = ref(0)
const localHeight = ref(0)

watch(
  region,
  (r) => {
    if (r) {
      localName.value = r.name
      localCategory.value = r.category
      localOrder.value = r.order
      localDescription.value = r.description
      localStatus.value = r.status
      localHidden.value = r.hidden
      localX.value = Math.round(r.position.x)
      localY.value = Math.round(r.position.y)
      localWidth.value = Math.round(r.position.width)
      localHeight.value = Math.round(r.position.height)
    }
  },
  { immediate: true, deep: true }
)

const area = computed(() => {
  if (!region.value) return 0
  return calculateRegionArea(region.value)
})

const categoryTagType: Record<RegionCategory, TagType> = {
  [RegionCategory.MAIN_TEXT]: 'info',
  [RegionCategory.HEAD_NOTE]: 'success',
  [RegionCategory.INTERLINE_NOTE]: 'warning',
  [RegionCategory.IMAGE]: 'default',
  [RegionCategory.TITLE_LABEL]: 'error',
  [RegionCategory.DAMAGED]: 'warning'
}

const categoryOptions = computed(() =>
  Object.values(RegionCategory).map((c) => ({
    label: RegionCategoryLabel[c],
    value: c,
    type: 'success' as const
  }))
)

const statusOptions = computed(() =>
  Object.values(RegionStatus).map((s) => ({
    label: RegionStatusLabel[s],
    value: s
  }))
)

function updateField<K extends keyof Omit<Region, 'id' | 'position'>>(
  field: K,
  value: Region[K]
) {
  if (!region.value) return
  const result = store.updateRegion(region.value.id, { [field]: value })
  if (!result.valid) {
    notify.warning(result.message)
    return
  }
  notify.success('已更新')
}

function updatePosition() {
  if (!region.value) return
  const result = store.updateRegion(region.value.id, {
    position: {
      x: localX.value,
      y: localY.value,
      width: localWidth.value,
      height: localHeight.value
    }
  })
  if (!result.valid) {
    notify.warning(result.message)
    return
  }
  notify.success('位置已更新')
}

function handleDelete() {
  if (!region.value) return
  const hasDesc = store.regionHasDescription(region.value.id)
  const doDelete = () => {
    const result = store.deleteRegion(region.value!.id)
    if (result.valid) {
      notify.success('区域已删除')
    } else {
      notify.error(result.message)
    }
  }
  if (hasDesc) {
    dialog.confirm(
      '二次确认',
      `区域「${region.value.name}」已填写说明，确定要删除吗？此操作不可撤销。`,
      doDelete,
      { positiveText: '确认删除', negativeText: '取消', type: 'warning' }
    )
  } else {
    doDelete()
  }
}
</script>

<template>
  <NCard title="区域属性" size="small" :bordered="false">
    <template v-if="region">
      <div style="margin-bottom: 12px">
        <NTag :type="categoryTagType[region.category]" bordered round>
          {{ RegionCategoryLabel[region.category] }}
        </NTag>
        <NText depth="3" style="margin-left: 8px; font-size: 12px">
          面积: {{ Math.round(area) }} px²
        </NText>
      </div>

      <NForm label-placement="left" label-width="70">
        <NFormItem label="名称">
          <NInput
            v-model:value="localName"
            :blur-on-enter="true"
            @blur="updateField('name', localName)"
          />
        </NFormItem>

        <NFormItem label="类别">
          <NSelect
            v-model:value="localCategory"
            :options="categoryOptions"
            @update:value="updateField('category', localCategory)"
          />
        </NFormItem>

        <NFormItem label="页内顺序">
          <NInputNumber
            v-model:value="localOrder"
            :min="1"
            :step="1"
            style="width: 100%"
            @update:value="updateField('order', localOrder)"
          />
        </NFormItem>

        <NFormItem label="整理状态">
          <NSelect
            v-model:value="localStatus"
            :options="statusOptions"
            @update:value="updateField('status', localStatus)"
          />
        </NFormItem>

        <NFormItem label="隐藏">
          <NSwitch
            v-model:value="localHidden"
            @update:value="updateField('hidden', localHidden)"
          />
          <NText depth="3" style="margin-left: 8px; font-size: 12px">
            不计入面积统计
          </NText>
        </NFormItem>

        <NDivider>位置与尺寸</NDivider>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
          <NFormItem label="X">
            <NInputNumber
              v-model:value="localX"
              :min="0"
              style="width: 100%"
              @update:value="updatePosition"
            />
          </NFormItem>
          <NFormItem label="Y">
            <NInputNumber
              v-model:value="localY"
              :min="0"
              style="width: 100%"
              @update:value="updatePosition"
            />
          </NFormItem>
          <NFormItem label="宽度">
            <NInputNumber
              v-model:value="localWidth"
              :min="1"
              style="width: 100%"
              @update:value="updatePosition"
            />
          </NFormItem>
          <NFormItem label="高度">
            <NInputNumber
              v-model:value="localHeight"
              :min="1"
              style="width: 100%"
              @update:value="updatePosition"
            />
          </NFormItem>
        </div>

        <NDivider>文字说明</NDivider>

        <NFormItem label="批注">
          <NInput
            v-model:value="localDescription"
            type="textarea"
            :rows="5"
            placeholder="输入文字说明、批注内容或备注..."
            :blur-on-enter="false"
            @blur="updateField('description', localDescription)"
          />
        </NFormItem>

        <NDivider />

        <NButton type="error" block @click="handleDelete">
          删除此区域
        </NButton>
      </NForm>
    </template>

    <div v-else style="text-align: center; padding: 40px 0; color: #999">
      <NText depth="3">请在画布或列表中选择一个区域</NText>
    </div>
  </NCard>
</template>
