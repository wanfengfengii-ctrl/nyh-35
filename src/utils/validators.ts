import { Region, SplitScheme, RegionCategory, ValidationResult, RegionPosition } from '@/types'

export function isRegionCategory(value: string): value is RegionCategory {
  return Object.values(RegionCategory).includes(value as RegionCategory)
}

export function validateRegionName(
  name: string,
  currentRegionId: string | null,
  regions: Region[]
): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, message: '区域名称不能为空' }
  }
  const duplicate = regions.find(
    (r) => r.id !== currentRegionId && r.name.trim() === name.trim()
  )
  if (duplicate) {
    return { valid: false, message: '同一方案内区域名称不能重复' }
  }
  return { valid: true, message: '' }
}

export function validateRegionCategory(category: string): ValidationResult {
  if (!isRegionCategory(category)) {
    return { valid: false, message: '区域类别必须属于预设类型' }
  }
  return { valid: true, message: '' }
}

export function validateRegionPosition(position: RegionPosition): ValidationResult {
  if (position.width <= 0 || position.height <= 0) {
    return { valid: false, message: '区域尺寸必须为正数' }
  }
  return { valid: true, message: '' }
}

export function validateRegionOrder(
  order: number,
  currentRegionId: string | null,
  regions: Region[]
): ValidationResult {
  if (!Number.isInteger(order) || order < 1) {
    return { valid: false, message: '页内顺序必须为正整数' }
  }
  const duplicate = regions.find(
    (r) => r.id !== currentRegionId && r.order === order
  )
  if (duplicate) {
    return { valid: false, message: `顺序 ${order} 已被区域「${duplicate.name}」占用` }
  }
  return { valid: true, message: '' }
}

export function validateSplitScheme(scheme: unknown): ValidationResult {
  if (!scheme || typeof scheme !== 'object') {
    return { valid: false, message: '方案数据格式无效' }
  }

  const s = scheme as Record<string, unknown>

  if (!s.id || typeof s.id !== 'string') {
    return { valid: false, message: '缺少有效的方案ID' }
  }
  if (!s.name || typeof s.name !== 'string') {
    return { valid: false, message: '缺少方案名称' }
  }
  if (!s.pageImageData || typeof s.pageImageData !== 'string') {
    return { valid: false, message: '缺少页面图像数据' }
  }
  if (!Array.isArray(s.regions)) {
    return { valid: false, message: '区域列表格式无效' }
  }

  for (let i = 0; i < s.regions.length; i++) {
    const region = s.regions[i] as Record<string, unknown>
    if (!region.id || typeof region.id !== 'string') {
      return { valid: false, message: `第 ${i + 1} 个区域缺少ID` }
    }
    if (!region.name || typeof region.name !== 'string') {
      return { valid: false, message: `第 ${i + 1} 个区域缺少名称` }
    }
    if (!validateRegionCategory(region.category as string).valid) {
      return {
        valid: false,
        message: `区域「${region.name}」类别无效`
      }
    }
    if (
      !region.position ||
      typeof region.position !== 'object' ||
      typeof (region.position as Record<string, unknown>).x !== 'number' ||
      typeof (region.position as Record<string, unknown>).y !== 'number' ||
      typeof (region.position as Record<string, unknown>).width !== 'number' ||
      typeof (region.position as Record<string, unknown>).height !== 'number'
    ) {
      return { valid: false, message: `区域「${region.name}」位置数据无效` }
    }
  }

  const names = new Set<string>()
  for (const region of s.regions as Region[]) {
    if (names.has(region.name)) {
      return { valid: false, message: `区域名称「${region.name}」重复` }
    }
    names.add(region.name)
  }

  return { valid: true, message: '' }
}

export function cloneSplitScheme(scheme: SplitScheme): SplitScheme {
  return {
    id: scheme.id,
    name: scheme.name,
    author: scheme.author,
    createdAt: scheme.createdAt,
    updatedAt: scheme.updatedAt,
    pageImageData: scheme.pageImageData,
    regions: scheme.regions.map((r) => ({
      ...r,
      position: { ...r.position }
    }))
  }
}
