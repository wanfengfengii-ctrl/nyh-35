<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { fabric } from 'fabric'
import { useMainStore } from '@/stores/main'
import { RegionCategory, RegionCategoryColor, Region, CandidateRegion, CandidateStatus, ConflictInfo } from '@/types'

interface Props {
  regions: Region[]
  selectedId: string | null
  readOnly?: boolean
  imageDataUrl: string
  imageWidth: number
  imageHeight: number
  candidates?: CandidateRegion[]
  conflicts?: ConflictInfo[]
  showCandidates?: boolean
  showConflicts?: boolean
  selectedCandidateId?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  readOnly: false,
  candidates: () => [],
  conflicts: () => [],
  showCandidates: true,
  showConflicts: true,
  selectedCandidateId: null
})

const emit = defineEmits<{
  (e: 'addRegion', position: { x: number; y: number; width: number; height: number }): void
  (e: 'selectRegion', id: string | null): void
  (e: 'updateRegionPosition', id: string, position: { x: number; y: number; width: number; height: number }): void
  (e: 'selectCandidate', id: string): void
}>()

const store = useMainStore()
const canvasEl = ref<HTMLCanvasElement | null>(null)
const containerEl = ref<HTMLDivElement | null>(null)
let fabricCanvas: fabric.Canvas | null = null
const regionRectMap = new Map<string, fabric.Object>()
const candidateRectMap = new Map<string, fabric.Object>()
const conflictOverlayMap = new Map<string, fabric.Object>()
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

  renderAll()
}

function handleSelection(e: fabric.IEvent<Event>) {
  const obj = e.selected?.[0]
  if (obj && obj.data?.regionId) {
    emit('selectRegion', obj.data.regionId as string)
  } else if (obj && obj.data?.candidateId) {
    emit('selectCandidate', obj.data.candidateId as string)
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

function clearAllOverlays() {
  if (!fabricCanvas) return
  for (const obj of regionRectMap.values()) fabricCanvas.remove(obj)
  for (const obj of candidateRectMap.values()) fabricCanvas.remove(obj)
  for (const obj of conflictOverlayMap.values()) fabricCanvas.remove(obj)
  regionRectMap.clear()
  candidateRectMap.clear()
  conflictOverlayMap.clear()
}

function renderAllRegions() {
  if (!fabricCanvas) return

  for (const region of props.regions) {
    addRegionRect(region)
  }
  updateSelectionVisual()
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
  regionRectMap.set(region.id, group)
}

function renderAllCandidates() {
  if (!fabricCanvas || !props.showCandidates) return

  for (const candidate of props.candidates) {
    if (candidate.status !== CandidateStatus.PENDING) continue
    addCandidateRect(candidate)
  }
}

function addCandidateRect(candidate: CandidateRegion) {
  if (!fabricCanvas) return
  const color = RegionCategoryColor[candidate.category]
  const dash = candidate.confidence >= 80 ? [8, 4] : candidate.confidence >= 60 ? [6, 6] : [4, 8]
  const isSelected = candidate.id === props.selectedCandidateId

  const rect = new fabric.Rect({
    left: candidate.position.x,
    top: candidate.position.y,
    width: candidate.position.width,
    height: candidate.position.height,
    fill: isSelected ? `${color}33` : `${color}11`,
    stroke: color,
    strokeWidth: isSelected ? 4 : 2,
    selectable: true,
    hasControls: false,
    hasBorders: true,
    data: { candidateId: candidate.id },
    strokeDashArray: dash,
    opacity: isSelected ? 1 : 0.9
  })

  const confLabel = new fabric.Text(`${candidate.confidence}%`, {
    left: candidate.position.x + candidate.position.width - 40,
    top: candidate.position.y + 2,
    fontSize: 11,
    fill: '#fff',
    backgroundColor: candidate.confidence >= 80 ? '#52c41a' : candidate.confidence >= 60 ? '#faad14' : '#ff4d4f',
    padding: 2,
    selectable: false,
    evented: false
  })

  const nameLabel = new fabric.Text(`${isSelected ? '▶ ' : ''}候选:${candidate.templateName}`, {
    left: candidate.position.x + 4,
    top: candidate.position.y + 2,
    fontSize: 11,
    fill: color,
    backgroundColor: isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)',
    padding: 2,
    selectable: false,
    evented: false,
    fontWeight: isSelected ? 'bold' : 'normal'
  })

  const group = new fabric.Group([rect, nameLabel, confLabel], {
    left: candidate.position.x,
    top: candidate.position.y,
    width: candidate.position.width,
    height: candidate.position.height,
    selectable: true,
    hasControls: false,
    data: { candidateId: candidate.id }
  })

  fabricCanvas.add(group)
  candidateRectMap.set(candidate.id, group)
}

function renderConflictOverlays() {
  if (!fabricCanvas || !props.showConflicts) return

  for (const conflict of props.conflicts) {
    if (conflict.resolved) continue
    if (conflict.type === 'overlap' && conflict.regionIds.length >= 2) {
      addConflictOverlay(conflict)
    }
  }
}

function addConflictOverlay(conflict: ConflictInfo) {
  if (!fabricCanvas) return
  const regions = conflict.regionIds
    .map(id => props.regions.find(r => r.id === id))
    .filter(Boolean) as Region[]
  if (regions.length < 2) return

  const color = conflict.severity === 'high' ? '#ff4d4f' : conflict.severity === 'medium' ? '#faad14' : '#52c41a'

  for (const region of regions) {
    const overlay = new fabric.Rect({
      left: region.position.x,
      top: region.position.y,
      width: region.position.width,
      height: region.position.height,
      fill: 'transparent',
      stroke: color,
      strokeWidth: 4,
      selectable: false,
      evented: false,
      strokeDashArray: [10, 5],
      opacity: 0.8
    })
    fabricCanvas.add(overlay)
    conflictOverlayMap.set(`${conflict.id}-${region.id}`, overlay)
  }
}

function renderAll() {
  if (!fabricCanvas) return
  clearAllOverlays()
  renderAllRegions()
  renderConflictOverlays()
  renderAllCandidates()
  fabricCanvas.renderAll()
}

function updateSelectionVisual() {
  if (!fabricCanvas) return
  for (const [id, obj] of regionRectMap.entries()) {
    const isSelected = id === props.selectedId
    const items = (obj as fabric.Group).getObjects()
    const rect = items[0] as fabric.Rect
    rect.set({
      strokeWidth: isSelected ? 4 : 2
    })
  }
  fabricCanvas.renderAll()
}

function updateCandidateSelectionVisual() {
  if (!fabricCanvas) return
  for (const [id, obj] of candidateRectMap.entries()) {
    const isSelected = id === props.selectedCandidateId
    const items = (obj as fabric.Group).getObjects()
    const rect = items[0] as fabric.Rect
    const label = items[1] as fabric.Text
    const confLabel = items[2] as fabric.Text
    const candidate = props.candidates.find(c => c.id === id)
    const color = candidate ? RegionCategoryColor[candidate.category] : '#999'

    rect.set({
      strokeWidth: isSelected ? 4 : 2,
      fill: isSelected ? `${color}33` : `${color}11`,
      opacity: isSelected ? 1 : 0.9
    })
    label.set({
      text: `${isSelected ? '▶ ' : ''}候选:${candidate?.templateName || ''}`,
      fontWeight: isSelected ? 'bold' : 'normal',
      backgroundColor: isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)'
    })
  }
  fabricCanvas.renderAll()
}

function setCanvasCandidateSelectionById() {
  if (!fabricCanvas || props.readOnly) return
  if (!props.selectedCandidateId) {
    return
  }
  const obj = candidateRectMap.get(props.selectedCandidateId)
  if (obj) {
    fabricCanvas.setActiveObject(obj)
    fabricCanvas.renderAll()
  }
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
    fabricCanvas.setActiveObject(obj)
    fabricCanvas.renderAll()
  }
}

watch(
  () => [props.regions, props.candidates, props.conflicts, props.showCandidates, props.showConflicts],
  () => {
    nextTick(renderAll)
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
  () => props.selectedCandidateId,
  () => {
    updateCandidateSelectionVisual()
    setCanvasCandidateSelectionById()
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
  candidateRectMap.clear()
  conflictOverlayMap.clear()
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
