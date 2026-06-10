<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { fabric } from 'fabric'
import {
  SpreadView,
  SpreadPage,
  SpreadLayout,
  Region,
  BreakRegion,
  BreakSeverity,
  RegionCategoryColor
} from '@/types'
import { getBreakSeverityColor, getBreakTypeColor } from '@/utils/breakDetection'

interface Props {
  spread: SpreadView
  breaks?: BreakRegion[]
  selectedBreakId?: string | null
  showHighlights?: boolean
  readOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  breaks: () => [],
  selectedBreakId: null,
  showHighlights: true,
  readOnly: false
})

const emit = defineEmits<{
  (e: 'selectBreak', id: string | null): void
  (e: 'adjustPageOffset', pageId: string, offset: { offsetX?: number; offsetY?: number }): void
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)
const containerEl = ref<HTMLDivElement | null>(null)
let fabricCanvas: fabric.Canvas | null = null
const pageImageMap = new Map<string, fabric.Image>()
const pageBaseMap = new Map<string, { baseX: number; baseY: number }>()
const breakOverlayMap = new Map<string, fabric.Object>()
const regionRectMap = new Map<string, fabric.Object>()
let isDragging = false
let dragPageId: string | null = null

const layoutInfo = computed(() => {
  const pages = props.spread.pages
  if (pages.length === 0) {
    return { totalWidth: 800, totalHeight: 600, positions: [] as Array<{ page: SpreadPage; x: number; y: number; baseX: number; baseY: number }> }
  }
  let maxHeight = 0
  let totalWidth = 0
  const positions: Array<{ page: SpreadPage; x: number; y: number; baseX: number; baseY: number }> = []

  const sortedPages = props.spread.layout === SpreadLayout.LEFT_RIGHT
    ? [...pages]
    : [...pages].reverse()

  let baseX = 0
  for (let i = 0; i < sortedPages.length; i++) {
    const page = sortedPages[i]
    const scaledHeight = page.image.height * page.offset.scale
    const scaledWidth = page.image.width * page.offset.scale
    const x = baseX + page.offset.offsetX
    const y = page.offset.offsetY
    positions.push({
      page,
      x,
      y,
      baseX,
      baseY: 0
    })
    maxHeight = Math.max(maxHeight, scaledHeight + y)
    totalWidth = Math.max(totalWidth, x + scaledWidth)
    baseX += scaledWidth + props.spread.pageGap
  }

  return {
    totalWidth: Math.max(totalWidth, 100),
    totalHeight: Math.max(maxHeight, 100),
    positions
  }
})

function initCanvas() {
  if (!canvasEl.value) return
  fabricCanvas = new fabric.Canvas(canvasEl.value, {
    width: layoutInfo.value.totalWidth,
    height: layoutInfo.value.totalHeight,
    selection: !props.readOnly,
    preserveObjectStacking: true,
    backgroundColor: '#f0f0f0'
  })
  renderPages()
  renderBreaks()
  renderRegions()
  setupCanvasEvents()
}

function setupCanvasEvents() {
  if (!fabricCanvas || props.readOnly) return

  fabricCanvas.on('mouse:down', (opt) => {
    const target = opt.target
    if (target && target.data && (target.data as any).pageId) {
      isDragging = true
      dragPageId = (target.data as any).pageId
    }
  })

  fabricCanvas.on('mouse:up', () => {
    if (isDragging && dragPageId) {
      const img = pageImageMap.get(dragPageId)
      const base = pageBaseMap.get(dragPageId)
      if (img && base) {
        const offsetX = (img.left || 0) - base.baseX
        const offsetY = (img.top || 0) - base.baseY
        emit('adjustPageOffset', dragPageId, { offsetX, offsetY })
      }
    }
    isDragging = false
    dragPageId = null
    renderRegions()
    renderBreaks()
  })

  fabricCanvas.on('object:moving', (opt) => {
    const target = opt.target
    if (!target || !target.data || !(target.data as any).pageId) return
    const pageId = (target.data as any).pageId
    const base = pageBaseMap.get(pageId)
    if (!base) return

    const offsetX = (target.left || 0) - base.baseX
    const offsetY = (target.top || 0) - base.baseY
    emit('adjustPageOffset', pageId, { offsetX, offsetY })
  })
}

function renderPages() {
  if (!fabricCanvas) return

  pageImageMap.forEach((img) => fabricCanvas?.remove(img))
  pageImageMap.clear()
  pageBaseMap.clear()

  for (const pos of layoutInfo.value.positions) {
    const { page, x, y, baseX, baseY } = pos
    pageBaseMap.set(page.pageId, { baseX, baseY })

    fabric.Image.fromURL(page.image.dataUrl, (img) => {
      if (!fabricCanvas) return
      img.set({
        left: x,
        top: y,
        selectable: !props.readOnly,
        evented: !props.readOnly,
        scaleX: page.offset.scale,
        scaleY: page.offset.scale,
        data: { pageId: page.pageId }
      })
      pageImageMap.set(page.pageId, img)
      fabricCanvas?.add(img)
      fabricCanvas?.sendToBack(img)
      fabricCanvas?.renderAll()
    })
  }

  if (layoutInfo.value.positions.length >= 2) {
    const firstPage = layoutInfo.value.positions[0]
    const seamX =
      firstPage.baseX +
      firstPage.page.image.width * firstPage.page.offset.scale +
      props.spread.pageGap / 2
    const seamLine = new fabric.Line(
      [seamX, 0, seamX, layoutInfo.value.totalHeight],
      {
        stroke: '#FF6B6B',
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
        opacity: 0.6
      }
    )
    fabricCanvas.add(seamLine)
  }
}

function renderRegions() {
  if (!fabricCanvas) return
  regionRectMap.forEach((rect) => fabricCanvas?.remove(rect))
  regionRectMap.clear()

  for (const pos of layoutInfo.value.positions) {
    const { page, x, y } = pos
    if (!page.scheme) continue
    for (const region of page.scheme.regions) {
      if (region.hidden) continue
      const color = RegionCategoryColor[region.category]
      const rect = new fabric.Rect({
        left: x + region.position.x * page.offset.scale,
        top: y + region.position.y * page.offset.scale,
        width: region.position.width * page.offset.scale,
        height: region.position.height * page.offset.scale,
        fill: 'transparent',
        stroke: color,
        strokeWidth: 2,
        selectable: false,
        evented: false,
        opacity: 0.7,
        data: { regionId: region.id }
      })
      regionRectMap.set(region.id, rect)
      fabricCanvas.add(rect)
    }
  }
}

function renderBreaks() {
  if (!fabricCanvas || !props.showHighlights) return
  breakOverlayMap.forEach((obj) => fabricCanvas?.remove(obj))
  breakOverlayMap.clear()

  for (const b of props.breaks) {
    const color =
      b.id === props.selectedBreakId
        ? getBreakSeverityColor(BreakSeverity.HIGH)
        : getBreakTypeColor(b.breakType)
    const opacity = b.resolved ? 0.25 : b.id === props.selectedBreakId ? 0.7 : 0.45

    const rect = new fabric.Rect({
      left: b.position.x,
      top: b.position.y,
      width: b.position.width,
      height: b.position.height,
      fill: color,
      stroke: color,
      strokeWidth: b.id === props.selectedBreakId ? 3 : 1,
      selectable: true,
      opacity,
      rx: 2,
      ry: 2,
      data: { breakId: b.id }
    })

    const labelText = b.resolved ? '✓' : '!'
    const label = new fabric.Text(labelText, {
      left: b.position.x + b.position.width / 2 - 6,
      top: b.position.y + 4,
      fontSize: 14,
      fontWeight: 'bold',
      fill: '#ffffff',
      selectable: false,
      evented: false
    })

    const group = new fabric.Group([rect, label], {
      selectable: true,
      data: { breakId: b.id }
    })

    group.on('mousedown', () => {
      emit('selectBreak', b.id)
    })

    breakOverlayMap.set(b.id, group)
    fabricCanvas.add(group)
  }
  fabricCanvas.renderAll()
}

function handleCanvasClick() {
  if (fabricCanvas && fabricCanvas.getActiveObject() === null) {
    emit('selectBreak', null)
  }
}

watch(
  () => props.spread,
  (newVal, oldVal) => {
    if (!fabricCanvas) return
    if (isDragging) return

    const sizeChanged =
      !oldVal ||
      oldVal.pageGap !== newVal.pageGap ||
      oldVal.pages.length !== newVal.pages.length ||
      oldVal.layout !== newVal.layout

    if (sizeChanged) {
      fabricCanvas.setWidth(layoutInfo.value.totalWidth)
      fabricCanvas.setHeight(layoutInfo.value.totalHeight)
      renderPages()
      renderRegions()
      renderBreaks()
    } else {
      for (const pos of layoutInfo.value.positions) {
        const img = pageImageMap.get(pos.page.pageId)
        const base = pageBaseMap.get(pos.page.pageId)
        if (img && base) {
          const needsMove =
            Math.abs(img.left! - pos.x) > 0.5 ||
            Math.abs(img.top! - pos.y) > 0.5 ||
            Math.abs(img.scaleX! - pos.page.offset.scale) > 0.001
          if (needsMove) {
            img.set({
              left: pos.x,
              top: pos.y,
              scaleX: pos.page.offset.scale,
              scaleY: pos.page.offset.scale
            })
          }
        }
        pageBaseMap.set(pos.page.pageId, { baseX: pos.baseX, baseY: pos.baseY })
      }
      renderRegions()
      renderBreaks()
      fabricCanvas.renderAll()
    }
  },
  { deep: true }
)

watch(
  () => props.breaks,
  () => {
    renderBreaks()
  },
  { deep: true }
)

watch(
  () => props.selectedBreakId,
  () => {
    renderBreaks()
  }
)

watch(
  () => props.showHighlights,
  () => {
    renderBreaks()
  }
)

onMounted(() => {
  nextTick(() => initCanvas())
})

onUnmounted(() => {
  if (fabricCanvas) {
    fabricCanvas.dispose()
    fabricCanvas = null
  }
  pageImageMap.clear()
  pageBaseMap.clear()
  breakOverlayMap.clear()
  regionRectMap.clear()
})
</script>

<template>
  <div
    ref="containerEl"
    style="width: 100%; height: 100%; overflow: auto; position: relative; background: #e8e8e8"
    @click="handleCanvasClick"
  >
    <canvas ref="canvasEl" />
  </div>
</template>
