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
const breakOverlayMap = new Map<string, fabric.Object>()
const regionRectMap = new Map<string, fabric.Object>()

const layoutInfo = computed(() => {
  const pages = props.spread.pages
  if (pages.length === 0) {
    return { totalWidth: 800, totalHeight: 600, positions: [] as Array<{ page: SpreadPage; x: number; y: number }> }
  }
  let maxHeight = 0
  let totalWidth = 0
  const positions: Array<{ page: SpreadPage; x: number; y: number }> = []

  if (props.spread.layout === SpreadLayout.LEFT_RIGHT) {
    let x = 0
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      const scaledHeight = page.image.height * page.offset.scale
      const scaledWidth = page.image.width * page.offset.scale
      positions.push({
        page,
        x: x + page.offset.offsetX,
        y: page.offset.offsetY
      })
      maxHeight = Math.max(maxHeight, scaledHeight + page.offset.offsetY)
      totalWidth = Math.max(totalWidth, x + scaledWidth + page.offset.offsetX)
      x += scaledWidth + props.spread.pageGap
    }
  } else {
    let x = 0
    const sorted = [...pages].reverse()
    for (let i = 0; i < sorted.length; i++) {
      const page = sorted[i]
      const scaledHeight = page.image.height * page.offset.scale
      const scaledWidth = page.image.width * page.offset.scale
      positions.push({
        page,
        x: x + page.offset.offsetX,
        y: page.offset.offsetY
      })
      maxHeight = Math.max(maxHeight, scaledHeight + page.offset.offsetY)
      totalWidth = Math.max(totalWidth, x + scaledWidth + page.offset.offsetX)
      x += scaledWidth + props.spread.pageGap
    }
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
}

function renderPages() {
  if (!fabricCanvas) return
  pageImageMap.forEach((img) => fabricCanvas?.remove(img))
  pageImageMap.clear()

  for (const pos of layoutInfo.value.positions) {
    const { page, x, y } = pos
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
      if (!props.readOnly) {
        img.on('moving', (e) => {
          const target = e.target
          if (target) {
            emit('adjustPageOffset', page.pageId, {
              offsetX: target.left as number,
              offsetY: target.top as number
            })
          }
        })
      }
      pageImageMap.set(page.pageId, img)
      fabricCanvas?.add(img)
      fabricCanvas?.sendToBack(img)
      fabricCanvas?.renderAll()
    })
  }

  if (layoutInfo.value.positions.length >= 2) {
    const seamX =
      layoutInfo.value.positions[0].x +
      layoutInfo.value.positions[0].page.image.width * layoutInfo.value.positions[0].page.offset.scale +
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

    group.on('selected', () => {
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
  () => [props.spread, props.showHighlights],
  () => {
    if (fabricCanvas) {
      fabricCanvas.setWidth(layoutInfo.value.totalWidth)
      fabricCanvas.setHeight(layoutInfo.value.totalHeight)
      renderPages()
      renderRegions()
      renderBreaks()
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

onMounted(() => {
  nextTick(() => initCanvas())
})

onUnmounted(() => {
  if (fabricCanvas) {
    fabricCanvas.dispose()
    fabricCanvas = null
  }
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
