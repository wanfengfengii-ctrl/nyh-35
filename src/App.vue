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
import AutoRecognitionPanel from '@/components/AutoRecognitionPanel.vue'
import ReviewPanel from '@/components/ReviewPanel.vue'
import ConflictPanel from '@/components/ConflictPanel.vue'
import VersionPanel from '@/components/VersionPanel.vue'
import LogPanel from '@/components/LogPanel.vue'
import BatchReportPanel from '@/components/BatchReportPanel.vue'
import SpreadCanvas from '@/components/SpreadCanvas.vue'
import SpreadProofreadingPanel from '@/components/SpreadProofreadingPanel.vue'
import type { Region, CandidateRegion, BreakRegion } from '@/types'

const store = useMainStore()
declare global {
  interface Window {
    $message: MessageApiInjection
    $dialog: DialogApiInjection
  }
}

const canvasKey = ref(0)
const compareCanvasKey = ref(0)
const spreadCanvasKey = ref(0)
const activeTab = ref<'list' | 'auto' | 'review' | 'conflict' | 'version' | 'log' | 'scheme' | 'stats' | 'report' | 'spread'>('list')

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

watch(
  () => store.currentSpreadId,
  () => {
    spreadCanvasKey.value++
  }
)

watch(
  () => store.isSpreadMode,
  (val) => {
    if (val) {
      activeTab.value = 'spread'
    } else if (activeTab.value === 'spread') {
      activeTab.value = 'list'
    }
  }
)

const hasImage = computed(() => !!store.pageImage)
const hasRegions = computed(() => store.regions.length > 0)
const hasSpread = computed(() => !!store.currentSpread)

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

function handleSelectCandidate(candidateId: string) {
  store.selectCandidate(candidateId)
  const candidate = store.selectedCandidate
  if (candidate) {
    window.$message?.info(`已选中候选：${candidate.templateName}（置信度 ${candidate.confidence}%）`)
  }
}

function handleSelectBreak(breakId: string | null) {
  store.selectBreak(breakId)
}

function handleAdjustPageOffset(pageId: string, offset: { offsetX?: number; offsetY?: number }) {
  if (!store.currentSpreadId) return
  store.adjustPageOffset(store.currentSpreadId, pageId, offset)
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
                <template v-if="store.isSpreadMode">
                  <template v-if="hasSpread">
                    <NCard :bordered="false" style="height: 100%" size="small">
                      <template #header>
                        <NSpace align="center">
                          <NText strong>
                            📖 {{ store.currentSpread?.name || '跨页视图' }}
                          </NText>
                          <NTag size="small" type="info" round>
                            {{ store.currentSpread?.layout === 'right_left' ? '中式：右-左' : '西式：左-右' }}
                          </NTag>
                          <NTag size="small" type="default" bordered round>
                            页数：{{ store.currentSpread?.pages.length || 0 }}
                          </NTag>
                          <NTag
                            v-if="store.spreadBreaks.length > 0"
                            size="small"
                            type="warning"
                            bordered
                            round
                          >
                            ⚠️ 检测到 {{ store.spreadBreaks.length }} 个问题（待处理 {{ store.unresolvedBreaks.length }}）
                          </NTag>
                        </NSpace>
                      </template>
                      <div style="height: calc(100% - 48px)">
                        <SpreadCanvas
                          v-if="store.currentSpread"
                          :key="spreadCanvasKey"
                          :spread="store.currentSpread"
                          :breaks="store.spreadBreaks as BreakRegion[]"
                          :selected-break-id="store.selectedBreakId"
                          :show-highlights="store.showBreakHighlights"
                          @select-break="handleSelectBreak"
                          @adjust-page-offset="handleAdjustPageOffset"
                        />
                        <NEmpty v-else description="请创建跨页视图" size="large" style="height: 100%" />
                      </div>
                    </NCard>
                  </template>
                  <template v-else>
                    <NEmpty
                      description="请在右侧面板创建跨页视图并添加书页"
                      size="large"
                      style="height: 100%"
                    />
                  </template>
                </template>
                <template v-else-if="hasImage">
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
                          :candidates="store.candidates"
                          :conflicts="store.conflicts"
                          :show-candidates="store.showCandidates"
                          :show-conflicts="store.showConflicts"
                          :selected-candidate-id="store.selectedCandidateId"
                          @add-region="handleAddRegion"
                          @select-region="handleSelectRegion"
                          @update-region-position="handleUpdatePosition"
                          @select-candidate="handleSelectCandidate"
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
                v-if="store.isSpreadMode || hasImage"
                width="360"
                style="border-left: 1px solid #e8e8e8; flex-shrink: 0; min-height: 0; overflow: hidden"
              >
                <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden">
                  <div style="padding: 4px 8px; border-bottom: 1px solid #eee; background: #fafafa">
                    <NTabs v-model:value="activeTab" size="small" type="line">
                      <NTabPane name="spread" tab="📖 跨页" v-if="store.isSpreadMode">
                        <div style="padding: 8px 0">
                          <SpreadProofreadingPanel />
                        </div>
                      </NTabPane>
                      <NTabPane name="list" tab="📋 区域" v-if="!store.isSpreadMode">
                        <div style="padding: 8px 0">
                          <NSpace vertical style="overflow: auto; max-height: calc(100vh - 180px)">
                            <RegionEditor />
                            <RegionList />
                          </NSpace>
                        </div>
                      </NTabPane>
                      <NTabPane name="auto" tab="🤖 识别" v-if="!store.isSpreadMode">
                        <div style="padding: 8px 0">
                          <NSpace vertical style="overflow: auto; max-height: calc(100vh - 180px)">
                            <AutoRecognitionPanel />
                          </NSpace>
                        </div>
                      </NTabPane>
                      <NTabPane name="review" tab="👥 复核" v-if="!store.isSpreadMode">
                        <div style="padding: 8px 0">
                          <NSpace vertical style="overflow: auto; max-height: calc(100vh - 180px)">
                            <ReviewPanel />
                          </NSpace>
                        </div>
                      </NTabPane>
                      <NTabPane name="conflict" tab="⚠️ 冲突" v-if="!store.isSpreadMode">
                        <div style="padding: 8px 0">
                          <NSpace vertical style="overflow: auto; max-height: calc(100vh - 180px)">
                            <ConflictPanel />
                          </NSpace>
                        </div>
                      </NTabPane>
                      <NTabPane name="version" tab="📚 版本" v-if="!store.isSpreadMode">
                        <div style="padding: 8px 0">
                          <NSpace vertical style="overflow: auto; max-height: calc(100vh - 180px)">
                            <VersionPanel />
                          </NSpace>
                        </div>
                      </NTabPane>
                      <NTabPane name="log" tab="📋 日志">
                        <div style="padding: 8px 0">
                          <NSpace vertical style="overflow: auto; max-height: calc(100vh - 180px)">
                            <LogPanel />
                          </NSpace>
                        </div>
                      </NTabPane>
                      <NTabPane name="scheme" tab="📁 方案" v-if="!store.isSpreadMode">
                        <div style="padding: 8px 0">
                          <SchemeManager />
                        </div>
                      </NTabPane>
                      <NTabPane name="stats" tab="📊 统计" v-if="!store.isSpreadMode">
                        <div style="padding: 8px 0">
                          <StatsPanel />
                        </div>
                      </NTabPane>
                      <NTabPane name="report" tab="📑 报表" v-if="!store.isSpreadMode">
                        <div style="padding: 8px 0">
                          <BatchReportPanel />
                        </div>
                      </NTabPane>
                    </NTabs>
                  </div>
                </div>
              </NLayoutSider>
            </NLayout>

            <NLayoutFooter
              v-if="(hasImage && store.currentScheme) || (store.isSpreadMode && hasSpread)"
              style="flex-shrink: 0; padding: 6px 16px; border-top: 1px solid #e8e8e8; background: #fafafa"
            >
              <NSpace align="center" :wrap="false" style="width: 100%; justify-content: space-between">
                <NSpace align="center">
                  <template v-if="!store.isSpreadMode">
                    <NText depth="3" style="font-size: 12px">
                      💾 方案：<strong>{{ store.currentScheme?.name }}</strong> ·
                      更新于 {{ store.currentScheme ? new Date(store.currentScheme.updatedAt).toLocaleString('zh-CN') : '' }}
                    </NText>
                  </template>
                  <template v-else>
                    <NText depth="3" style="font-size: 12px">
                      📖 跨页：<strong>{{ store.currentSpread?.name }}</strong> ·
                      {{ store.currentSpread ? new Date(store.currentSpread.updatedAt).toLocaleString('zh-CN') : '' }}
                    </NText>
                  </template>
                </NSpace>
                <NSpace align="center">
                  <template v-if="!store.isSpreadMode">
                    <NTag size="small" type="default" bordered round v-if="hasRegions">
                      已按顺序排序 · 顺序范围 1 ~ {{ Math.max(...store.regions.map(r => r.order)) }}
                    </NTag>
                    <NTag v-else size="small" type="warning" bordered round>
                      暂无区域
                    </NTag>
                    <NTag
                      v-if="store.pendingCandidates.length > 0"
                      size="small"
                      type="info"
                      bordered
                      round
                    >
                      🤖 待处理候选: {{ store.pendingCandidates.length }}
                    </NTag>
                    <NTag
                      v-if="store.unresolvedConflicts.length > 0"
                      size="small"
                      type="error"
                      bordered
                      round
                    >
                      ⚠️ 冲突: {{ store.unresolvedConflicts.length }}
                    </NTag>
                    <NTag
                      v-if="store.currentSchemeVersions.length > 0"
                      size="small"
                      type="success"
                      bordered
                      round
                    >
                      📚 版本: {{ store.currentSchemeVersions.length }}
                    </NTag>
                  </template>
                  <template v-else>
                    <NTag size="small" type="default" bordered round>
                      页数: {{ store.currentSpread?.pages.length || 0 }}
                    </NTag>
                    <NTag
                      v-if="store.spreadBreaks.length > 0"
                      size="small"
                      type="warning"
                      bordered
                      round
                    >
                      ⚠️ 问题: {{ store.unresolvedBreaks.length }}/{{ store.spreadBreaks.length }}
                    </NTag>
                    <NTag
                      v-if="store.lastAlignmentResult"
                      size="small"
                      type="info"
                      bordered
                      round
                    >
                      🎯 对齐置信度: {{ store.lastAlignmentResult.confidence }}%
                    </NTag>
                    <NTag
                      v-if="store.currentSpreadProofreading"
                      size="small"
                      type="success"
                      bordered
                      round
                    >
                      📝 {{ store.currentSpreadProofreading.status === 'in_progress' ? '校对中' : store.currentSpreadProofreading.status === 'reviewed' ? '已复核' : store.currentSpreadProofreading.status === 'finalized' ? '已定稿' : '未开始' }}
                    </NTag>
                  </template>
                </NSpace>
              </NSpace>
            </NLayoutFooter>
          </NLayout>
        </NNotificationProvider>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>
