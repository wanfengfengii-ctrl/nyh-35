<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMainStore } from '@/stores/main'
import {
  NCard,
  NButton,
  NList,
  NListItem,
  NTag,
  NText,
  NInput,
  NPopconfirm,
  NSelect,
  useMessage,
  useDialog,
  NModal,
  NSpace,
  NIcon
} from 'naive-ui'
import type { SplitScheme } from '@/types'

const store = useMainStore()
const message = useMessage()
const dialog = useDialog()

const showNewSchemeModal = ref(false)
const newSchemeName = ref('')

const showRenameModal = ref(false)
const renameSchemeId = ref('')
const renameName = ref('')

const showDuplicateModal = ref(false)
const duplicateSchemeId = ref('')
const duplicateName = ref('')

const compareSelectOptions = computed(() =>
  store.schemes
    .filter((s) => s.id !== store.currentSchemeId)
    .map((s) => ({ label: s.name, value: s.id }))
)

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function handleCreateScheme() {
  if (!newSchemeName.value.trim()) {
    message.warning('请输入方案名称')
    return
  }
  store.createScheme(newSchemeName.value.trim())
  newSchemeName.value = ''
  showNewSchemeModal.value = false
  message.success('方案已创建')
}

function openRename(s: SplitScheme) {
  renameSchemeId.value = s.id
  renameName.value = s.name
  showRenameModal.value = true
}

function handleRename() {
  if (!renameName.value.trim()) {
    message.warning('名称不能为空')
    return
  }
  store.renameScheme(renameSchemeId.value, renameName.value.trim())
  showRenameModal.value = false
  message.success('已重命名')
}

function openDuplicate(s: SplitScheme) {
  duplicateSchemeId.value = s.id
  duplicateName.value = `${s.name} (副本)`
  showDuplicateModal.value = true
}

function handleDuplicate() {
  if (!duplicateName.value.trim()) {
    message.warning('名称不能为空')
    return
  }
  const result = store.duplicateScheme(duplicateSchemeId.value, duplicateName.value.trim())
  if (result) {
    showDuplicateModal.value = false
    message.success('方案已复制')
  }
}

function handleDelete(s: SplitScheme) {
  dialog.warning({
    title: '删除方案',
    content: `确定删除切分方案「${s.name}」吗？此操作不可撤销。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      store.deleteScheme(s.id)
      message.success('方案已删除')
    }
  })
}

function handleExport(s: SplitScheme) {
  const json = store.exportScheme(s.id)
  if (!json) {
    message.error('导出失败')
    return
  }
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${s.name}.json`
  a.click()
  URL.revokeObjectURL(url)
  message.success('已导出')
}

function handleImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const oldCount = store.schemes.length
      const oldCurrentId = store.currentSchemeId
      const result = store.importScheme(content)
      if (!result.valid) {
        message.error(`导入失败：${result.message}`)
        if (store.currentSchemeId !== oldCurrentId) {
          store.currentSchemeId = oldCurrentId
        }
        if (store.schemes.length > oldCount) {
          store.schemes.splice(oldCount)
        }
        return
      }
      store.currentSchemeId = oldCurrentId
      message.success(result.message)
    }
    reader.onerror = () => message.error('文件读取失败')
    reader.readAsText(file)
  }
  input.click()
}
</script>

<template>
  <NCard title="切分方案管理" size="small" :bordered="false">
    <NSpace vertical style="width: 100%">
      <NSpace>
        <NButton type="primary" size="small" @click="showNewSchemeModal = true">
          <template #icon><NIcon>➕</NIcon></template>
          新建方案
        </NButton>
        <NButton size="small" @click="handleImport">
          <template #icon><NIcon>📥</NIcon></template>
          导入
        </NButton>
      </NSpace>

      <template v-if="store.isCompareMode">
        <NSelect
          placeholder="选择对比方案"
          clearable
          :options="compareSelectOptions"
          :value="store.compareSchemeId"
          @update:value="store.setCompareScheme"
        />
      </template>

      <NList bordered size="small" style="max-height: 280px; overflow: auto">
        <NListItem
          v-for="s in store.schemes"
          :key="s.id"
          style="padding: 8px 12px"
          :style="{
            background: store.currentSchemeId === s.id ? '#e6f7ff' : 'transparent'
          }"
        >
          <div
            style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%"
          >
            <div style="flex: 1; min-width: 0; cursor: pointer" @click="store.switchScheme(s.id)">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px">
                <NText strong>{{ s.name }}</NText>
                <NTag
                  v-if="store.currentSchemeId === s.id"
                  size="small"
                  type="primary"
                  round
                >
                  当前
                </NTag>
                <NTag
                  v-if="store.compareSchemeId === s.id"
                  size="small"
                  type="info"
                  round
                >
                  对比
                </NTag>
              </div>
              <NText depth="3" style="font-size: 11px">
                {{ s.author }} · {{ formatDate(s.updatedAt) }}
              </NText>
              <div style="margin-top: 2px">
                <NTag size="tiny" type="default" bordered>
                  {{ s.regions.length }} 个区域
                </NTag>
              </div>
            </div>
            <NSpace vertical size="small" style="flex-shrink: 0; margin-left: 8px">
              <NButton size="tiny" text @click="openRename(s)">改名</NButton>
              <NButton size="tiny" text @click="openDuplicate(s)">复制</NButton>
              <NButton size="tiny" text type="info" @click="handleExport(s)">导出</NButton>
              <NPopconfirm @positive-click="handleDelete(s)">
                <template #trigger>
                  <NButton size="tiny" text type="error">删除</NButton>
                </template>
                确定删除「{{ s.name }}」？
              </NPopconfirm>
            </NSpace>
          </div>
        </NListItem>
      </NList>
      <div v-if="store.schemes.length === 0" style="text-align: center; padding: 16px 0">
        <NText depth="3">暂无切分方案</NText>
      </div>
    </NSpace>

    <NModal v-model:show="showNewSchemeModal" preset="card" title="新建切分方案" style="width: 420px">
      <NInput v-model:value="newSchemeName" placeholder="请输入方案名称" />
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showNewSchemeModal = false">取消</NButton>
          <NButton type="primary" @click="handleCreateScheme">创建</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="showRenameModal" preset="card" title="重命名方案" style="width: 420px">
      <NInput v-model:value="renameName" placeholder="请输入新名称" />
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showRenameModal = false">取消</NButton>
          <NButton type="primary" @click="handleRename">确定</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="showDuplicateModal" preset="card" title="复制方案" style="width: 420px">
      <NInput v-model:value="duplicateName" placeholder="请输入副本名称" />
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showDuplicateModal = false">取消</NButton>
          <NButton type="primary" @click="handleDuplicate">复制</NButton>
        </NSpace>
      </template>
    </NModal>
  </NCard>
</template>
