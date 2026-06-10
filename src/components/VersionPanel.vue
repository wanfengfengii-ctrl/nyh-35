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
  NModal,
  NInput,
  NBadge
} from 'naive-ui'
import { SchemeVersion } from '@/types'

const store = useMainStore()
const message = useMessage()
const dialog = useDialog()

const showSaveModal = ref(false)
const versionDescription = ref('')

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function handleSave() {
  if (!store.currentScheme) {
    message.warning('请先选择方案')
    return
  }
  const version = store.saveVersion(versionDescription.value.trim())
  if (version) {
    message.success(`版本 v${version.versionNumber} 已保存`)
    versionDescription.value = ''
    showSaveModal.value = false
  }
}

function handleRestore(version: SchemeVersion) {
  dialog.warning({
    title: '版本恢复确认',
    content: `确定要恢复到「${version.name}」吗？当前方案的所有未保存修改将被覆盖。`,
    positiveText: '确认恢复',
    negativeText: '取消',
    onPositiveClick: () => {
      const result = store.restoreVersion(version.id)
      if (result.valid) {
        message.success(result.message)
      } else {
        message.error(result.message)
      }
    }
  })
}

function handleDelete(version: SchemeVersion) {
  dialog.warning({
    title: '删除版本确认',
    content: `确定要删除「${version.name}」吗？此操作不可撤销。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: () => {
      store.deleteVersion(version.id)
      message.success('版本已删除')
    }
  })
}
</script>

<template>
  <NCard title="📚 版本回溯" size="small" :bordered="false">
    <NSpace vertical style="width: 100%">
      <NSpace justify="space-between" style="width: 100%">
        <NText depth="3" style="font-size: 12px">
          已保存 {{ store.currentSchemeVersions.length }} 个版本
        </NText>
        <NButton
          size="small"
          type="primary"
          :disabled="!store.currentScheme"
          @click="showSaveModal = true"
        >
          <template #icon><NIcon>💾</NIcon></template>
          保存当前版本
        </NButton>
      </NSpace>

      <template v-if="store.currentSchemeVersions.length > 0">
        <div style="border: 1px solid #eee; border-radius: 6px; max-height: 300px; overflow: auto">
          <NList bordered size="small" style="border: none">
            <NListItem
              v-for="v in store.currentSchemeVersions"
              :key="v.id"
              style="padding: 10px 12px"
            >
              <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%">
                <div style="flex: 1; min-width: 0">
                  <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap">
                    <NText strong>v{{ v.versionNumber }}</NText>
                    <NBadge
                      v-if="v === store.currentSchemeVersions[0]"
                      value="最新"
                      type="success"
                      :show-zero="true"
                      processing
                    />
                    <NTag v-if="v.reviewCount > 0" size="small" type="info" round>
                      {{ v.reviewCount }} 条复核意见
                    </NTag>
                    <NTag size="small" bordered round>
                      {{ v.snapshot.regions.length }} 个区域
                    </NTag>
                  </div>
                  <NText depth="3" style="font-size: 11px; display: block; margin-bottom: 2px">
                    {{ v.createdBy }} · {{ formatTime(v.createdAt) }}
                  </NText>
                  <NText v-if="v.description" depth="2" style="font-size: 12px">
                    {{ v.description }}
                  </NText>
                </div>
                <NSpace vertical size="small" style="margin-left: 8px; flex-shrink: 0">
                  <NButton size="tiny" text type="primary" @click="handleRestore(v)">
                    恢复
                  </NButton>
                  <NButton size="tiny" text type="error" @click="handleDelete(v)">
                    删除
                  </NButton>
                </NSpace>
              </div>
            </NListItem>
          </NList>
        </div>
      </template>

      <NEmpty v-else description="暂无保存的版本，点击「保存当前版本」开始版本管理" size="small" />
    </NSpace>

    <NModal v-model:show="showSaveModal" preset="card" title="保存方案版本" style="width: 460px">
      <NSpace vertical>
        <NInput
          v-model:value="versionDescription"
          type="textarea"
          :rows="3"
          placeholder="输入此版本的说明（可选），例如：初始标注完成、第一轮复核完成等..."
        />
        <NText depth="3" style="font-size: 12px">
          当前方案将完整保存，包括所有区域的位置、属性和状态。
        </NText>
      </NSpace>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showSaveModal = false">取消</NButton>
          <NButton type="primary" @click="handleSave">保存版本</NButton>
        </NSpace>
      </template>
    </NModal>
  </NCard>
</template>
