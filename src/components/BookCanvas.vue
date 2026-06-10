<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { fabric } from 'fabric'
import { useMainStore } from '@/stores/main'
import { RegionCategory, RegionCategoryColor, Region } from '@/types'

interface Props {
  regions: Region[]
  selectedId: string | null
  readOnly?: boolean
  imageDataUrl: string
  imageWidth: number
  imageHeight: number
}

const props = withDefaults(defineProps<Props>(), {
  readOnly: false
})

const emit = defineEmits<{
  (e: 'addRegion', position: { x: number; y: number; width: number; height: number }): void
  (e: 'selectRegion', id: string | null): void
  (e: 'updateRegionPosition', id: string, position: { x: number; y: number; width: number; height: number }): void
}>()

const store = useMainStore()
const canvasEl = ref<HTMLCanvasElement | null>(null)
const containerEl = ref<HTMLDivElement | null>(null)
let fabricCanvas: fabric.Canvas | null = null
const regionRectMap = new Map<string, fabric.Rect>()
let isDrawing = false
let drawStartX = 0
let drawStartY = 0
let drawingRect: fabric.Rect | null = null
let bgImageElement: fabric.Image | null = null

const drawingColor = computed(() => RegionCategoryColor[store.drawingCategory])

function initCanvas() {
  if (!canvasEl.value) return
  fabricCanvas = new fabric.Canvas(canvasEl.value, {
    width: props.imageWidth,
    height: props.imageHeight,
    selection: !props.readOnly,
    preserveObjectStacking: true
  })

  fabric.Image.fromURL(props.imageDataUrl, (img) => {
    if (!fabricCanvas) return
    bgImageElement = img
    img.set({
      left: 0,
      top: 0,
      selectable: false,
      evented: false
    })
    fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas), {
      scaleX: props.imageWidth / img.width!,
      scaleY: props.imageHeight / img.height!
    })
  })

  if (!props.readOnly) {
    fabricCanvas.on('mouse:down', handleMouseDown)
    fabricCanvas.on('mouse:move', handleMouseMove)
    fabricCanvas.on('mouse:up', handleMouseUp)
    fabricCanvas.on('selection:created', handleSelection)
    fabricCanvas.on('selection:updated', handleSelection)
    fabricCanvas.on('selection:cleared', () => emit('selectRegion', null))
    fabricCanvas.on('object:modified', handleObjectModified)
  }

  renderAllRegions()
}

function handleSelection(e: fabric.IEvent<Event>) {
  const obj = e.selected?.[0]
  if (obj && obj.data?.regionId) {
    emit('selectRegion', obj.data.regionId as string)
  }
}

function handleObjectModified(e: fabric.IEvent<Event>) {
  const obj = e.target
  if (!obj || !obj.data?.regionId) return
  const id = obj.data.regionId as string
  const x = obj.left || 0
  const y = obj.top || 0
  const width = (obj.width || 0) * (obj.scaleX || 1)
  const height = (obj.height || 0) * (obj.scaleY || 1)
  obj.set({ scaleX: 1, scaleY: 1, width, height })
  emit('updateRegionPosition', id, { x, y, width, height })
}

function handleMouseDown(e: fabric.IEvent<MouseEvent>) {
  if (!store.isDrawingMode || !fabricCanvas) return
  if (e.target) return
  isDrawing = true
  const pointer = fabricCanvas.getPointer(e.e)
  drawStartX = pointer.x
  drawStartY = pointer.y
  drawingRect = new fabric.Rect({
    left: drawStartX,
    top: drawStartY,
    width: 0,
    height: 0,
    fill: `${drawingColor.value}33`,
    stroke: drawingColor.value,
    strokeWidth: 2,
    selectable: false,
    strokeDashArray: [5, 5]
  })
  fabricCanvas.add(drawingRect)
}

function handleMouseMove(e: fabric.IEvent<MouseEvent>) {
  if (!isDrawing || !drawingRect || !fabricCanvas) return
  const pointer = fabricCanvas.getPointer(e.e)
  const x = Math.min(drawStartX, pointer.x)
  const y = Math.min(drawStartY, pointer.y)
  const w = Math.abs(pointer.x - drawStartX)
  const h = Math.abs(pointer.y - drawStartY)
  drawingRect.set({ left: x, top: y, width: w, height: h })
  fabricCanvas.renderAll()
}

function handleMouseUp() {
  if (!isDrawing || !drawingRect || !fabricCanvas) return
  isDrawing = false
  const x = drawingRect.left || 0
  const y = drawingRect.top || 0
  const w = drawingRect.width || 0
  const h = drawingRect.height || 0
  fabricCanvas.remove(drawingRect)
  drawingRect = null
  if (w > 5 && h > 5) {
    emit('addRegion', { x, y, width: w, height: h })
  }
}

function renderAllRegions() {
  if (!fabricCanvas) return
  for (const rect of regionRectMap.values()) {
    fabricCanvas.remove(rect)
  }
  regionRectMap.clear()

  for (const region of props.regions) {
    addRegionRect(region)
  }
  updateSelectionVisual()
  fabricCanvas.renderAll()
}

function addRegionRect(region: Region) {
  if (!fabricCanvas) return
  const color = RegionCategoryColor[region.category]
  const rect = new fabric.Rect({
    left: region.position.x,
    top: region.position.y,
    width: region.position.width,
    height: region.position.height,
    fill: `${color}22`,
    stroke: color,
    strokeWidth: region.id === props.selectedId ? 3 : 2,
    selectable: !props.readOnly,
    hasControls: !props.readOnly,
    hasBorders: true,
    data: { regionId: region.id },
    opacity: region.hidden ? 0.15 : 1,
    strokeDashArray: region.hidden ? [3, 3] : undefined
  })

  const labelText = new fabric.Text(`${region.order}.${region.name}`, {
    left: region.position.x + 4,
    top: region.position.y + 2,
    fontSize: 12,
    fill: color,
    backgroundColor: 'rgba(255,255,255,0.85)',
    padding: 2,
    selectable: false,
    evented: false,
    opacity: region.hidden ? 0.4 : 1
  })

  const group = new fabric.Group([rect, labelText], {
    left: region.position.x,
    top: region.position.y,
    width: region.position.width,
    height: region.position.height,
    selectable: !props.readOnly,
    hasControls: !props.readOnly,
    data: { regionId: region.id }
  })

  fabricCanvas.add(group)
  regionRectMap.set(region.id, group as unknown as fabric.Rect)
}

function updateSelectionVisual() {
  if (!fabricCanvas) return
  for (const [id, obj] of regionRectMap.entries()) {
    const isSelected = id === props.selectedId
    const items = (obj as unknown as fabric.Group).getObjects()
    const rect = items[0] as fabric.Rect
    rect.set({
      strokeWidth: isSelected ? 4 : 2
    })
  }
  fabricCanvas.renderAll()
}

function setCanvasSelectionById() {
  if (!fabricCanvas || props.readOnly) return
  if (!props.selectedId) {
    fabricCanvas.discardActiveObject()
    fabricCanvas.renderAll()
    return
  }
  const obj = regionRectMap.get(props.selectedId)
  if (obj) {
    fabricCanvas.setActiveObject(obj as unknown as fabric.Object)
    fabricCanvas.renderAll()
  }
}

watch(
  () => props.regions,
  () => {
    nextTick(renderAllRegions)
  },
  { deep: true }
)

watch(
  () => props.selectedId,
  () => {
    updateSelectionVisual()
    setCanvasSelectionById()
  }
)

watch(
  () => store.isDrawingMode,
  (val) => {
    if (!fabricCanvas) return
    fabricCanvas.selection = !val
    for (const obj of regionRectMap.values()) {
      obj.set({ selectable: !val && !props.readOnly })
    }
    fabricCanvas.renderAll()
  }
)

onMounted(() => {
  nextTick(initCanvas)
})

onUnmounted(() => {
  if (fabricCanvas) {
    fabricCanvas.dispose()
    fabricCanvas = null
  }
  regionRectMap.clear()
})

defineExpose({
  getCanvas: () => fabricCanvas
})
</script>

<template>
  <div ref="containerEl" class="fabric-canvas-container">
    <canvas ref="canvasEl"></canvas>
  </div>
</template>
