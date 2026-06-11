import { ref, watch, computed } from 'vue'
import type { Region, RegionCategory, RegionStatus, RegionPosition } from '@/types'
import { useRegionStore } from '@/stores/region'
import { useNotify } from '@/utils/common'
import { calculateRegionArea } from '@/utils/statistics'

export function useRegionEditor() {
  const regionStore = useRegionStore()
  const notify = useNotify()

  const localName = ref('')
  const localCategory = ref<RegionCategory | ''>('')
  const localOrder = ref(1)
  const localDescription = ref('')
  const localStatus = ref<RegionStatus | ''>('')
  const localHidden = ref(false)
  const localX = ref(0)
  const localY = ref(0)
  const localWidth = ref(0)
  const localHeight = ref(0)

  const region = computed(() => regionStore.selectedRegion)

  const area = computed(() => {
    if (!region.value) return 0
    return calculateRegionArea(region.value)
  })

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

  function updateField<K extends keyof Omit<Region, 'id' | 'position'>>(
    field: K,
    value: Region[K]
  ): void {
    if (!region.value) return
    const result = regionStore.updateRegion(region.value.id, { [field]: value })
    if (!result.valid) {
      notify.warning(result.message)
      return
    }
    notify.success('已更新')
  }

  function updatePosition(): void {
    if (!region.value) return
    const position: RegionPosition = {
      x: localX.value,
      y: localY.value,
      width: localWidth.value,
      height: localHeight.value
    }
    const result = regionStore.updateRegion(region.value.id, { position })
    if (!result.valid) {
      notify.warning(result.message)
      return
    }
    notify.success('位置已更新')
  }

  function selectRegion(regionId: string | null): void {
    regionStore.selectRegion(regionId)
  }

  return {
    region,
    area,
    localName,
    localCategory,
    localOrder,
    localDescription,
    localStatus,
    localHidden,
    localX,
    localY,
    localWidth,
    localHeight,
    updateField,
    updatePosition,
    selectRegion
  }
}
