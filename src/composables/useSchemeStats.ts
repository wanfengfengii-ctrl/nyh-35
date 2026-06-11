import { computed } from 'vue'
import type { SchemeStats } from '@/types'
import { useRegionStore } from '@/stores/region'
import { calculateSchemeStats } from '@/utils/statistics'

export function useSchemeStats() {
  const regionStore = useRegionStore()

  const currentStats = computed<SchemeStats | null>(() => {
    if (!regionStore.pageImage || !regionStore.currentScheme) return null
    return calculateSchemeStats(
      regionStore.currentScheme.regions,
      regionStore.pageImage.width,
      regionStore.pageImage.height
    )
  })

  return {
    currentStats
  }
}
