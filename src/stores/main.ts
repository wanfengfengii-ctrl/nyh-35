import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import {
  Region,
  SplitScheme,
  PageImage,
  RegionCategory,
  RegionStatus,
  RegionPosition,
  ValidationResult
} from '@/types'
import {
  validateRegionName,
  validateRegionCategory,
  validateRegionPosition,
  validateRegionOrder,
  validateSplitScheme,
  cloneSplitScheme
} from '@/utils/validators'
import { calculateSchemeStats } from '@/utils/statistics'
import type { SchemeStats } from '@/types'

export const useMainStore = defineStore('main', () => {
  const pageImage = ref<PageImage | null>(null)
  const schemes = ref<SplitScheme[]>([])
  const currentSchemeId = ref<string | null>(null)
  const selectedRegionId = ref<string | null>(null)
  const compareSchemeId = ref<string | null>(null)
  const isCompareMode = ref(false)
  const isDrawingMode = ref(false)
  const drawingCategory = ref<RegionCategory>(RegionCategory.MAIN_TEXT)
  const currentAuthor = ref('整理员')

  const currentScheme = computed<SplitScheme | null>(() => {
    if (!currentSchemeId.value) return null
    return schemes.value.find((s) => s.id === currentSchemeId.value) || null
  })

  const compareScheme = computed<SplitScheme | null>(() => {
    if (!compareSchemeId.value) return null
    return schemes.value.find((s) => s.id === compareSchemeId.value) || null
  })

  const regions = computed<Region[]>(() => {
    return currentScheme.value?.regions || []
  })

  const selectedRegion = computed<Region | null>(() => {
    if (!selectedRegionId.value) return null
    return regions.value.find((r) => r.id === selectedRegionId.value) || null
  })

  const sortedRegions = computed<Region[]>(() => {
    return [...regions.value].sort((a, b) => a.order - b.order)
  })

  const currentStats = computed<SchemeStats | null>(() => {
    if (!pageImage.value || !currentScheme.value) return null
    return calculateSchemeStats(
      currentScheme.value.regions,
      pageImage.value.width,
      pageImage.value.height
    )
  })

  function getNextRegionOrder(): number {
    if (regions.value.length === 0) return 1
    return Math.max(...regions.value.map((r) => r.order)) + 1
  }

  function getNextRegionName(category: RegionCategory): string {
    const prefixMap: Record<RegionCategory, string> = {
      [RegionCategory.MAIN_TEXT]: '正文',
      [RegionCategory.HEAD_NOTE]: '眉批',
      [RegionCategory.INTERLINE_NOTE]: '夹注',
      [RegionCategory.IMAGE]: '图像',
      [RegionCategory.TITLE_LABEL]: '题签',
      [RegionCategory.DAMAGED]: '缺损'
    }
    const prefix = prefixMap[category]
    let num = 1
    let name = `${prefix}${num}`
    while (regions.value.some((r) => r.name === name)) {
      num++
      name = `${prefix}${num}`
    }
    return name
  }

  function loadPageImage(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        const img = new Image()
        img.onload = () => {
          pageImage.value = {
            id: uuidv4(),
            name: file.name,
            dataUrl,
            width: img.width,
            height: img.height
          }
          if (schemes.value.length === 0) {
            createScheme('初始方案')
          }
          resolve()
        }
        img.onerror = () => reject(new Error('图像加载失败'))
        img.src = dataUrl
      }
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsDataURL(file)
    })
  }

  function createScheme(name: string): SplitScheme {
    const scheme: SplitScheme = {
      id: uuidv4(),
      name,
      author: currentAuthor.value,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pageImageData: pageImage.value?.dataUrl || '',
      regions: []
    }
    schemes.value.push(scheme)
    currentSchemeId.value = scheme.id
    selectedRegionId.value = null
    return scheme
  }

  function switchScheme(schemeId: string): void {
    const scheme = schemes.value.find((s) => s.id === schemeId)
    if (scheme) {
      currentSchemeId.value = schemeId
      selectedRegionId.value = null
      if (pageImage.value && scheme.pageImageData !== pageImage.value.dataUrl) {
        const img = new Image()
        img.onload = () => {
          if (pageImage.value) {
            pageImage.value = {
              ...pageImage.value,
              dataUrl: scheme.pageImageData,
              width: img.width,
              height: img.height
            }
          }
        }
        img.src = scheme.pageImageData
      }
    }
  }

  function deleteScheme(schemeId: string): void {
    const idx = schemes.value.findIndex((s) => s.id === schemeId)
    if (idx === -1) return
    schemes.value.splice(idx, 1)
    if (currentSchemeId.value === schemeId) {
      currentSchemeId.value = schemes.value.length > 0 ? schemes.value[0].id : null
      selectedRegionId.value = null
    }
    if (compareSchemeId.value === schemeId) {
      compareSchemeId.value = null
    }
  }

  function duplicateScheme(schemeId: string, newName: string): SplitScheme | null {
    const scheme = schemes.value.find((s) => s.id === schemeId)
    if (!scheme) return null
    const cloned = cloneSplitScheme(scheme)
    cloned.id = uuidv4()
    cloned.name = newName
    cloned.author = currentAuthor.value
    cloned.createdAt = Date.now()
    cloned.updatedAt = Date.now()
    cloned.regions = cloned.regions.map((r) => ({ ...r, id: uuidv4() }))
    schemes.value.push(cloned)
    return cloned
  }

  function exportScheme(schemeId: string): string {
    const scheme = schemes.value.find((s) => s.id === schemeId)
    if (!scheme) return ''
    return JSON.stringify(scheme, null, 2)
  }

  function importScheme(jsonStr: string): ValidationResult {
    try {
      const data = JSON.parse(jsonStr)
      const validation = validateSplitScheme(data)
      if (!validation.valid) {
        return validation
      }
      const scheme = data as SplitScheme
      scheme.id = uuidv4()
      scheme.createdAt = Date.now()
      scheme.updatedAt = Date.now()
      scheme.regions = scheme.regions.map((r) => ({ ...r, id: uuidv4() }))
      schemes.value.push(scheme)
      return { valid: true, message: '方案导入成功' }
    } catch {
      return { valid: false, message: 'JSON解析失败' }
    }
  }

  function addRegion(
    position: RegionPosition,
    category: RegionCategory
  ): ValidationResult {
    if (!currentScheme.value) {
      return { valid: false, message: '请先选择一个切分方案' }
    }
    const posValidation = validateRegionPosition(position)
    if (!posValidation.valid) return posValidation
    const catValidation = validateRegionCategory(category)
    if (!catValidation.valid) return catValidation

    const region: Region = {
      id: uuidv4(),
      name: getNextRegionName(category),
      category,
      order: getNextRegionOrder(),
      description: '',
      status: RegionStatus.PENDING,
      hidden: false,
      position: { ...position }
    }
    currentScheme.value.regions.push(region)
    currentScheme.value.updatedAt = Date.now()
    selectedRegionId.value = region.id
    return { valid: true, message: '区域已添加' }
  }

  function updateRegion(
    regionId: string,
    updates: Partial<Omit<Region, 'id'>>
  ): ValidationResult {
    if (!currentScheme.value) {
      return { valid: false, message: '请先选择一个切分方案' }
    }
    const region = currentScheme.value.regions.find((r) => r.id === regionId)
    if (!region) {
      return { valid: false, message: '区域不存在' }
    }

    if (updates.name !== undefined) {
      const nameValidation = validateRegionName(
        updates.name,
        regionId,
        currentScheme.value.regions
      )
      if (!nameValidation.valid) return nameValidation
    }
    if (updates.category !== undefined) {
      const catValidation = validateRegionCategory(updates.category)
      if (!catValidation.valid) return catValidation
    }
    if (updates.order !== undefined) {
      const orderValidation = validateRegionOrder(
        updates.order,
        regionId,
        currentScheme.value.regions
      )
      if (!orderValidation.valid) return orderValidation
    }
    if (updates.position !== undefined) {
      const posValidation = validateRegionPosition(updates.position)
      if (!posValidation.valid) return posValidation
    }

    Object.assign(region, updates)
    if (updates.position) {
      region.position = { ...updates.position }
    }
    currentScheme.value.updatedAt = Date.now()
    return { valid: true, message: '区域已更新' }
  }

  function deleteRegion(regionId: string): ValidationResult {
    if (!currentScheme.value) {
      return { valid: false, message: '请先选择一个切分方案' }
    }
    const idx = currentScheme.value.regions.findIndex((r) => r.id === regionId)
    if (idx === -1) {
      return { valid: false, message: '区域不存在' }
    }
    currentScheme.value.regions.splice(idx, 1)
    currentScheme.value.updatedAt = Date.now()
    if (selectedRegionId.value === regionId) {
      selectedRegionId.value = null
    }
    return { valid: true, message: '区域已删除' }
  }

  function regionHasDescription(regionId: string): boolean {
    const region = regions.value.find((r) => r.id === regionId)
    return !!(region && region.description && region.description.trim().length > 0)
  }

  function selectRegion(regionId: string | null): void {
    selectedRegionId.value = regionId
  }

  function toggleRegionHidden(regionId: string): void {
    updateRegion(regionId, { hidden: !selectedRegion.value?.hidden })
  }

  function setCompareMode(enabled: boolean): void {
    isCompareMode.value = enabled
    if (!enabled) {
      compareSchemeId.value = null
    }
  }

  function setCompareScheme(schemeId: string | null): void {
    compareSchemeId.value = schemeId
  }

  function setDrawingMode(enabled: boolean): void {
    isDrawingMode.value = enabled
  }

  function setDrawingCategory(category: RegionCategory): void {
    drawingCategory.value = category
  }

  function renameScheme(schemeId: string, newName: string): void {
    const scheme = schemes.value.find((s) => s.id === schemeId)
    if (scheme) {
      scheme.name = newName
      scheme.updatedAt = Date.now()
    }
  }

  function clearAll(): void {
    pageImage.value = null
    schemes.value = []
    currentSchemeId.value = null
    selectedRegionId.value = null
    compareSchemeId.value = null
    isCompareMode.value = false
  }

  return {
    pageImage,
    schemes,
    currentSchemeId,
    selectedRegionId,
    compareSchemeId,
    isCompareMode,
    isDrawingMode,
    drawingCategory,
    currentAuthor,
    currentScheme,
    compareScheme,
    regions,
    selectedRegion,
    sortedRegions,
    currentStats,
    loadPageImage,
    createScheme,
    switchScheme,
    deleteScheme,
    duplicateScheme,
    exportScheme,
    importScheme,
    addRegion,
    updateRegion,
    deleteRegion,
    regionHasDescription,
    selectRegion,
    toggleRegionHidden,
    setCompareMode,
    setCompareScheme,
    setDrawingMode,
    setDrawingCategory,
    renameScheme,
    clearAll
  }
})
