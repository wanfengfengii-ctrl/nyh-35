<script setup lang="ts">
import { computed } from 'vue'
import { useMainStore } from '@/stores/main'
import {
  NButton,
  NButtonGroup,
  NSpace,
  NIcon,
  NUpload,
  NDivider,
  NTag,
  NSelect,
  NInput,
  useMessage,
  NTooltip,
  NSwitch,
  NText
} from 'naive-ui'
import {
  RegionCategory,
  RegionCategoryLabel,
  RegionCategoryColor
} from '@/types'

const store = useMainStore()
const message = useMessage()

const categoryOptions = computed(() =>
  Object.values(RegionCategory).map((c) => ({
    label: RegionCategoryLabel[c],
    value: c,
    color: RegionCategoryColor[c]
  }))
)

async function handleUploadFile(file: File) {
  try {
    await store.loadPageImage(file)
    message.success('书页图像已加载')
  } catch (e) {
    message.error((e as Error).message)
  }
  return false
}
</script>

<template>
  <div style="padding: 8px 16px; border-bottom: 1px solid #e8e8e8; background: #fafafa">
    <NSpace align="center" :wrap="false">
      <NText strong style="font-size: 16px; margin-right: 12px">
        📜 古籍版式切分与批注整理台
      </NText>

      <NDivider vertical style="height: 24px" />

      <NUpload :show-file-list="false" accept="image/*" :custom-request="({ file }) => handleUploadFile(file as File)">
        <NButton size="small" type="primary">
          <template #icon><NIcon>🖼</NIcon></template>
          导入书页图像
        </NButton>
      </NUpload>

      <template v-if="store.pageImage">
        <NDivider vertical style="height: 24px" />

        <NTooltip trigger="hover">
          <template #trigger>
            <div>
              <NSwitch
                v-model:value="store.isDrawingMode"
                round
                :checked-value="true"
                :unchecked-value="false"
              />
            </div>
          </template>
          {{ store.isDrawingMode ? '当前为绘制模式（在画布上拖动创建区域）' : '当前为选择移动模式' }}
        </NTooltip>

        <span style="font-size: 12px; color: #666; margin-left: -4px">
          {{ store.isDrawingMode ? '绘制' : '选择' }}
        </span>

        <template v-if="store.isDrawingMode">
          <NSelect
            size="small"
            :value="store.drawingCategory"
            :options="categoryOptions"
            style="width: 140px"
            @update:value="store.setDrawingCategory"
          >
            <template #label="{ label, color }">
              <NTag size="small" round :color="color" text-color="#fff">
                {{ label }}
              </NTag>
            </template>
          </NSelect>
        </template>

        <NDivider vertical style="height: 24px" />

        <NButtonGroup size="small">
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton :type="!store.isCompareMode && !store.isSpreadMode ? 'info' : 'default'" @click="store.setSpreadMode(false); store.setCompareMode(false)">
                <template #icon><NIcon>🎯</NIcon></template>
                编辑
              </NButton>
            </template>
            编辑模式：单画布编辑
          </NTooltip>
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton :type="store.isCompareMode ? 'info' : 'default'" @click="store.setSpreadMode(false); store.setCompareMode(true)">
                <template #icon><NIcon>⚖️</NIcon></template>
                对比
              </NButton>
            </template>
            并排对比模式：双画布比较不同方案
          </NTooltip>
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton :type="store.isSpreadMode ? 'info' : 'default'" @click="store.setCompareMode(false); store.setSpreadMode(true)">
                <template #icon><NIcon>📖</NIcon></template>
                跨页
              </NButton>
            </template>
            跨页校对模式：古籍跨页拼接与连续版心校对
          </NTooltip>
        </NButtonGroup>

        <template v-if="store.currentScheme">
          <NDivider vertical style="height: 24px" />
          <NInput
            v-model:value="store.currentAuthor"
            size="small"
            placeholder="整理员姓名"
            style="width: 130px"
            clearable
          >
            <template #prefix><NIcon>👤</NIcon></template>
          </NInput>

          <NTag size="small" type="default" bordered round>
            {{ store.pageImage.name }} · {{ store.pageImage.width }}×{{ store.pageImage.height }}
          </NTag>
        </template>
      </template>
    </NSpace>
  </div>
</template>
