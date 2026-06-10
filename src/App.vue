<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NMessageProvider, NDialogProvider, NNotificationProvider, NConfigProvider, NLayout, NLayoutSider, NLayoutContent, NLayoutHeader, NLayoutFooter, NSpace, NEmpty, NTag, NTabs, NTabPane, NText } from 'naive-ui'
import { useMainStore } from '@/stores/main'
import { NCard } from 'naive-ui'
import type { DialogApiInjection } from 'naive-ui/es/dialog/src/DialogProvider'
import type { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider'
import Toolbar from '@/components/Toolbar.vue'
import BookCanvas from '@/components/BookCanvas.vue'
import RegionEditor from '@/components/RegionEditor.vue'
import RegionList from '@/components/RegionList.vue'
import SchemeManager from '@/components/SchemeManager.vue'
import StatsPanel from '@/components/StatsPanel.vue'
import type { Region } from '@/types'

const store = useMainStore()
declare global {
  interface Window {
    $message: MessageApiInjection
    $dialog: DialogApiInjection
  }
}

const canvasKey = ref(0)
const compareCanvasKey = ref(0)
const activeTab = ref<'list' | 'scheme' | 'stats'>('list')

watch(
  () => store.currentSchemeId,
  () => {
    canvasKey.value++
  }
)

watch(
  () => store.compareSchemeId,
  () => {
    compareCanvasKey.value++
  }
)

const hasImage = computed(() => !!store.pageImage)
const hasRegions = computed(() => store.regions.length > 0)

function handleAddRegion(position: { x: number; y: number; width: number; height: number }) {
  const result = store.addRegion(position, store.drawingCategory)
  if (!result.valid) {
    window.$message?.warning(result.message)
  }
}

function handleSelectRegion(id: string | null) {
  store.selectRegion(id)
}

function handleUpdatePosition(id: string, position: { x: number; y: number; width: number; height: number }) {
  const result = store.updateRegion(id, { position })
  if (!result.valid) {
    window.$message?.warning(result.message)
  }
}
</script>

<script lang="ts">
export default {
  name: 'App'
}
</script>

<template>
  <NConfigProvider>
    <NMessageProvider>
      <NDialogProvider>
        <NNotificationProvider>
          <NLayout style="height: 100vh; width: 100vw">
            <NLayoutHeader style="flex-shrink: 0">
              <Toolbar />
            </NLayoutHeader>

            <NLayout has-sider style="flex: 1; min-height: 0">
              <NLayoutContent style="padding: 12px; background: #f5f5f5; min-height: 0; overflow: hidden">
                <template v-if="hasImage">
                  <template v-if="!store.isCompareMode">
                    <NCard :bordered="false" style="height: 100%" size="small">
                      <template #header>
                        <NSpace align="center">
                          <NText strong>
                            {{ store.currentScheme?.name || '当前方案' }}
                          </NText>
                          <NTag size="small" v-if="store.isDrawingMode" type="primary" round>
                            绘制模式 · 选择类别后在画布上拖动鼠标框选
                          </NTag>
                          <NTag size="small" v-else type="success" round>
                            选择移动模式 · 点击选中后可拖动/缩放区域
                          </NTag>
                          <NTag size="small" type="default" bordered round>
                            区域数：{{ store.regions.length }}
                          </NTag>
                        </NSpace>
                      </template>
                      <div style="height: calc(100% - 48px)">
                        <BookCanvas
                          :key="canvasKey"
                          :regions="store.regions as Region[]"
                          :selected-id="store.selectedRegionId"
                          :image-data-url="store.pageImage!.dataUrl"
                          :image-width="store.pageImage!.width"
                          :image-height="store.pageImage!.height"
                          @add-region="handleAddRegion"
                          @select-region="handleSelectRegion"
                          @update-region-position="handleUpdatePosition"
                        />
                      </div>
                    </NCard>
                  </template>

                  <template v-else>
                    <NSpace style="height: 100%" :wrap="false">
                      <NCard :bordered="false" style="flex: 1; height: 100%; min-width: 0" size="small">
                        <template #header>
                          <NSpace align="center">
                            <NText strong>
                              🎯 当前方案：{{ store.currentScheme?.name || '-' }}
                            </NText>
                            <NTag type="primary" size="small" round>{{ store.currentScheme?.author }}</NTag>
                            <NTag size="small" type="default" bordered round>
                              {{ store.currentScheme?.regions.length || 0 }} 个区域
                            </NTag>
                          </NSpace>
                        </template>
                        <div style="height: calc(100% - 48px)">
                          <BookCanvas
                            v-if="store.currentScheme"
                            :key="'left-' + canvasKey"
                            :regions="store.currentScheme.regions as Region[]"
                            :selected-id="null"
                            read-only
                            :image-data-url="store.pageImage!.dataUrl"
                            :image-width="store.pageImage!.width"
                            :image-height="store.pageImage!.height"
                            @select-region="handleSelectRegion"
                          />
                          <NEmpty v-else description="请先选择方案" size="large" style="height: 100%" />
                        </div>
                      </NCard>

                      <NCard :bordered="false" style="flex: 1; height: 100%; min-width: 0" size="small">
                        <template #header>
                          <NSpace align="center">
                            <NText strong>
                              ⚖️ 对比方案：{{ store.compareScheme?.name || '未选择' }}
                            </NText>
                            <NTag v-if="store.compareScheme" type="info" size="small" round>
                              {{ store.compareScheme.author }}
                            </NTag>
                            <NTag v-if="store.compareScheme" size="small" type="default" bordered round>
                              {{ store.compareScheme.regions.length }} 个区域
                            </NTag>
                          </NSpace>
                        </template>
                        <div style="height: calc(100% - 48px)">
                          <BookCanvas
                            v-if="store.compareScheme"
                            :key="'right-' + compareCanvasKey"
                            :regions="store.compareScheme.regions as Region[]"
                            :selected-id="null"
                            read-only
                            :image-data-url="store.pageImage!.dataUrl"
                            :image-width="store.pageImage!.width"
                            :image-height="store.pageImage!.height"
                          />
                          <NEmpty v-else description="请在左侧下拉选择对比方案" size="large" style="height: 100%" />
                        </div>
                      </NCard>
                    </NSpace>
                  </template>
                </template>

                <NEmpty
                  v-else
                  description="请先导入古籍书页扫描图像开始工作"
                  size="large"
                  style="height: 100%"
                >
                  <template #extra>
                    <div style="max-width: 560px; margin: 0 auto; text-align: left">
                      <NText depth="3">
                        <div style="margin-bottom: 12px">📚 <strong>使用说明：</strong></div>
                        <ol style="padding-left: 20px; line-height: 1.9">
                          <li>点击「导入书页图像」选择古籍书页扫描图片</li>
                          <li>打开「绘制模式」，选择区域类别，在画布上拖动鼠标框选区域</li>
                          <li>切换至「选择模式」可拖动、缩放已有区域，或点击选中后在右侧面板编辑属性</li>
                          <li>可为每个区域设置：类别、名称、页内顺序、批注文字、整理状态</li>
                          <li>创建多个切分方案，并使用「对比」模式并排比较不同方案</li>
                          <li>可导出方案为 JSON 文件存档，也可导入已有方案继续整理</li>
                        </ol>
                        <div style="margin-top: 12px">
                          <NTag size="small" type="info" round>预设类别：正文栏 / 眉批 / 夹注 / 图像 / 题签 / 缺损区</NTag>
                        </div>
                      </NText>
                    </div>
                  </template>
                </NEmpty>
              </NLayoutContent>

              <NLayoutSider
                v-if="hasImage"
                width="360"
                style="border-left: 1px solid #e8e8e8; flex-shrink: 0; min-height: 0; overflow: hidden"
              >
                <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden">
                  <div style="padding: 4px 8px; border-bottom: 1px solid #eee; background: #fafafa">
                    <NTabs v-model:value="activeTab" size="small" type="line">
                      <NTabPane name="list" tab="📋 区域与属性">
                        <div style="padding: 8px 0">
                          <NSpace vertical style="overflow: auto; max-height: calc(100vh - 180px)">
                            <RegionEditor />
                            <RegionList />
                          </NSpace>
                        </div>
                      </NTabPane>
                      <NTabPane name="scheme" tab="📁 方案管理">
                        <div style="padding: 8px 0">
                          <SchemeManager />
                        </div>
                      </NTabPane>
                      <NTabPane name="stats" tab="📊 统计分析">
                        <div style="padding: 8px 0">
                          <StatsPanel />
                        </div>
                      </NTabPane>
                    </NTabs>
                  </div>
                </div>
              </NLayoutSider>
            </NLayout>

            <NLayoutFooter
              v-if="hasImage && store.currentScheme"
              style="flex-shrink: 0; padding: 6px 16px; border-top: 1px solid #e8e8e8; background: #fafafa"
            >
              <NSpace align="center" :wrap="false" style="width: 100%; justify-content: space-between">
                <NSpace align="center">
                  <NText depth="3" style="font-size: 12px">
                    💾 方案：<strong>{{ store.currentScheme.name }}</strong> ·
                    更新于 {{ new Date(store.currentScheme.updatedAt).toLocaleString('zh-CN') }}
                  </NText>
                </NSpace>
                <NSpace align="center">
                  <NTag size="small" type="default" bordered round v-if="hasRegions">
                    已按顺序排序 · 顺序范围 1 ~ {{ Math.max(...store.regions.map(r => r.order)) }}
                  </NTag>
                  <NTag size="small" type="warning" bordered round v-else>
                    暂无区域
                  </NTag>
                </NSpace>
              </NSpace>
            </NLayoutFooter>
          </NLayout>
        </NNotificationProvider>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>
