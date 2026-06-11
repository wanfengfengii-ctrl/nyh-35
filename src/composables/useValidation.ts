import type {
  Region,
  RegionCategory,
  RegionPosition,
  ValidationResult
} from '@/types'
import {
  validateRegionName,
  validateRegionCategory,
  validateRegionPosition,
  validateRegionOrder,
  validateSplitScheme
} from '@/utils/region/validators'
import { useNotify } from '@/utils/common/notification'

export function useValidation() {
  const notify = useNotify()

  function checkRegionName(
    name: string,
    currentRegionId: string | null,
    regions: Region[]
  ): boolean {
    const result = validateRegionName(name, currentRegionId, regions)
    if (!result.valid) {
      notify.warning(result.message)
    }
    return result.valid
  }

  function checkRegionCategory(category: string): boolean {
    const result = validateRegionCategory(category)
    if (!result.valid) {
      notify.warning(result.message)
    }
    return result.valid
  }

  function checkRegionPosition(position: RegionPosition): boolean {
    const result = validateRegionPosition(position)
    if (!result.valid) {
      notify.warning(result.message)
    }
    return result.valid
  }

  function checkRegionOrder(
    order: number,
    currentRegionId: string | null,
    regions: Region[]
  ): boolean {
    const result = validateRegionOrder(order, currentRegionId, regions)
    if (!result.valid) {
      notify.warning(result.message)
    }
    return result.valid
  }

  function checkSplitScheme(scheme: unknown): ValidationResult {
    return validateSplitScheme(scheme)
  }

  function checkAddRegionParams(
    position: RegionPosition,
    category: RegionCategory
  ): boolean {
    return (
      checkRegionCategory(category as string) && checkRegionPosition(position)
    )
  }

  function checkUpdateRegionParams(
    region: Region,
    updates: Partial<Omit<Region, 'id'>>,
    regions: Region[]
  ): boolean {
    if (updates.name !== undefined) {
      if (!checkRegionName(updates.name, region.id, regions)) return false
    }
    if (updates.category !== undefined) {
      if (!checkRegionCategory(updates.category as string)) return false
    }
    if (updates.order !== undefined) {
      if (!checkRegionOrder(updates.order, region.id, regions)) return false
    }
    if (updates.position !== undefined) {
      if (!checkRegionPosition(updates.position)) return false
    }
    return true
  }

  return {
    checkRegionName,
    checkRegionCategory,
    checkRegionPosition,
    checkRegionOrder,
    checkSplitScheme,
    checkAddRegionParams,
    checkUpdateRegionParams
  }
}
