import {
  RegionStatus
} from '@/types'
import type {
  Region,
  RegionCategory,
  ValidationResult,
  RegionPosition
} from '@/types'
import { RegionCategory as RegionCategoryEnum } from '@/types'

export function isRegionCategory(value: string): value is RegionCategory {
  return Object.values(RegionCategoryEnum).includes(value as RegionCategory)
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

  if (typeof s.id !== 'string' || s.id.length === 0) {
    return { valid: false, message: '缺少有效的方案ID' }
  }
  if (typeof s.name !== 'string' || s.name.trim().length === 0) {
    return { valid: false, message: '缺少方案名称' }
  }
  if (typeof s.pageImageData !== 'string' || s.pageImageData.length === 0) {
    return { valid: false, message: '缺少页面图像数据' }
  }
  if (!s.pageImageData.startsWith('data:image/')) {
    return { valid: false, message: '页面图像数据格式不合法' }
  }
  if (!Array.isArray(s.regions)) {
    return { valid: false, message: '区域列表格式无效' }
  }

  function isFinitePositive(n: unknown): boolean {
    return typeof n === 'number' && Number.isFinite(n) && n >= 0
  }
  function isFinitePositiveInt(n: unknown): boolean {
    return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) && n >= 1
  }

  for (let i = 0; i < s.regions.length; i++) {
    const region = s.regions[i] as Record<string, unknown>
    const idxLabel = `第 ${i + 1} 个区域`

    if (typeof region.id !== 'string' || region.id.length === 0) {
      return { valid: false, message: `${idxLabel}缺少ID` }
    }
    if (typeof region.name !== 'string' || region.name.trim().length === 0) {
      return { valid: false, message: `${idxLabel}缺少名称` }
    }
    if (!validateRegionCategory(String(region.category)).valid) {
      return { valid: false, message: `区域「${region.name}」类别无效` }
    }
    if (!isFinitePositiveInt(region.order)) {
      return { valid: false, message: `区域「${region.name}」顺序必须为正整数` }
    }
    if (typeof region.description !== 'string') {
      return { valid: false, message: `区域「${region.name}」批注字段格式无效` }
    }
    if (
      typeof region.status !== 'string' ||
      !Object.values(RegionStatus).includes(region.status as RegionStatus)
    ) {
      return { valid: false, message: `区域「${region.name}」整理状态无效` }
    }
    if (typeof region.hidden !== 'boolean') {
      return { valid: false, message: `区域「${region.name}」隐藏字段格式无效` }
    }
    const pos = region.position as Record<string, unknown>
    if (
      !pos ||
      typeof pos !== 'object' ||
      !isFinitePositive(pos.x) ||
      !isFinitePositive(pos.y) ||
      !isFinitePositive(pos.width) ||
      !isFinitePositive(pos.height) ||
      (pos.width as number) <= 0 ||
      (pos.height as number) <= 0
    ) {
      return { valid: false, message: `区域「${region.name}」位置/尺寸数据无效` }
    }
  }

  const names = new Set<string>()
  for (const region of s.regions as Region[]) {
    const trimmed = region.name.trim()
    if (names.has(trimmed)) {
      return { valid: false, message: `区域名称「${trimmed}」重复` }
    }
    names.add(trimmed)
  }

  const orders = new Set<number>()
  for (const region of s.regions as Region[]) {
    if (orders.has(region.order)) {
      return { valid: false, message: `区域顺序 ${region.order} 重复（「${region.name}」）` }
    }
    orders.add(region.order)
  }

  return { valid: true, message: '' }
}
