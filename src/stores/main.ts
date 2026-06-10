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
  ValidationResult,
  RegionTemplate,
  CandidateRegion,
  CandidateStatus,
  ReviewOpinion,
  ReviewDecision,
  ConflictInfo,
  ReviewLogEntry,
  SchemeVersion,
  BatchReport
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
import {
  generateCandidates,
  createRegionFromCandidate,
  detectConflicts,
  mergeReviewOpinions,
  createTemplateFromRegion,
  deduplicateCandidates
} from '@/utils/semiAuto'
import {
  createReviewLog,
  createSchemeVersion,
  getNextVersionNumber,
  generateBatchReport
} from '@/utils/reviewUtils'

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

  const templates = ref<RegionTemplate[]>([])
  const candidates = ref<CandidateRegion[]>([])
  const reviewOpinions = ref<ReviewOpinion[]>([])
  const conflicts = ref<ConflictInfo[]>([])
  const reviewLogs = ref<ReviewLogEntry[]>([])
  const schemeVersions = ref<SchemeVersion[]>([])
  const isReviewMode = ref(false)
  const isAutoRecognitionMode = ref(false)
  const showCandidates = ref(true)
  const showConflicts = ref(true)
  const confidenceThreshold = ref(60)
  const selectedCandidateId = ref<string | null>(null)

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

  const pendingCandidates = computed(() =>
    candidates.value.filter(c => c.status === CandidateStatus.PENDING)
  )

  const acceptedCandidates = computed(() =>
    candidates.value.filter(c => c.status === CandidateStatus.ACCEPTED)
  )

  const selectedCandidate = computed(() => {
    if (!selectedCandidateId.value) return null
    return candidates.value.find(c => c.id === selectedCandidateId.value) || null
  })

  const unresolvedConflicts = computed(() =>
    conflicts.value.filter(c => !c.resolved)
  )

  const currentSchemeVersions = computed(() =>
    schemeVersions.value
      .filter(v => v.schemeId === currentSchemeId.value)
      .sort((a, b) => b.versionNumber - a.versionNumber)
  )

  const currentSchemeOpinions = computed(() =>
    reviewOpinions.value.filter(o =>
      currentScheme.value?.regions.some(r => r.id === o.regionId)
    )
  )

  const currentSchemeLogs = computed(() =>
    reviewLogs.value
      .filter(l => l.schemeId === currentSchemeId.value)
      .sort((a, b) => b.timestamp - a.timestamp)
  )

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

  function importScheme(jsonStr: string): ValidationResult & { schemeId?: string } {
    let data: unknown
    try {
      data = JSON.parse(jsonStr)
    } catch {
      return { valid: false, message: 'JSON解析失败，文件内容不是合法JSON' }
    }

    let validation: ValidationResult
    try {
      validation = validateSplitScheme(data)
    } catch (e) {
      return { valid: false, message: `校验异常：${(e as Error).message || '未知错误'}` }
    }
    if (!validation.valid) {
      return validation
    }

    try {
      const src = data as SplitScheme
      const now = Date.now()
      const scheme: SplitScheme = {
        id: uuidv4(),
        name: src.name,
        author: src.author && typeof src.author === 'string' ? src.author : '导入整理员',
        createdAt: now,
        updatedAt: now,
        pageImageData: src.pageImageData,
        regions: src.regions.map((r) => ({
          id: uuidv4(),
          name: r.name,
          category: r.category,
          order: r.order,
          description: r.description || '',
          status: r.status,
          hidden: !!r.hidden,
          position: {
            x: r.position.x,
            y: r.position.y,
            width: r.position.width,
            height: r.position.height
          }
        }))
      }
      schemes.value.push(scheme)
      return { valid: true, message: `已导入方案「${scheme.name}」(${scheme.regions.length}个区域)`, schemeId: scheme.id }
    } catch (e) {
      return { valid: false, message: `构建方案失败：${(e as Error).message || '未知错误'}` }
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
    templates.value = []
    candidates.value = []
    reviewOpinions.value = []
    conflicts.value = []
    reviewLogs.value = []
    schemeVersions.value = []
    isReviewMode.value = false
    isAutoRecognitionMode.value = false
  }

  function addLog(action: string, details: string, regionId: string | null = null, before: unknown | null = null, after: unknown | null = null): void {
    if (!currentSchemeId.value) return
    reviewLogs.value.push(createReviewLog(currentAuthor.value, action, currentSchemeId.value, details, regionId, before, after))
  }

  function saveTemplateFromRegion(regionId: string): ValidationResult {
    const region = regions.value.find(r => r.id === regionId)
    if (!region) return { valid: false, message: '区域不存在' }
    if (!pageImage.value) return { valid: false, message: '缺少页面图像信息' }
    const template = createTemplateFromRegion(region, pageImage.value.width, pageImage.value.height)
    templates.value.push(template)
    addLog('创建模板', `从区域「${region.name}」创建模板「${template.name}」`, regionId)
    return { valid: true, message: `已保存模板「${template.name}」` }
  }

  function deleteTemplate(templateId: string): void {
    const idx = templates.value.findIndex(t => t.id === templateId)
    if (idx !== -1) {
      const t = templates.value[idx]
      templates.value.splice(idx, 1)
      addLog('删除模板', `删除模板「${t.name}」`)
    }
  }

  function runAutoRecognition(): ValidationResult {
    if (!pageImage.value) return { valid: false, message: '请先导入书页图像' }
    if (templates.value.length === 0) return { valid: false, message: '暂无可用模板，请先从已有区域保存模板' }
    if (!currentScheme.value) return { valid: false, message: '请先选择切分方案' }

    const rawCandidates = generateCandidates(
      templates.value,
      pageImage.value.width,
      pageImage.value.height,
      currentScheme.value.regions
    )
    candidates.value = deduplicateCandidates(rawCandidates)
    isAutoRecognitionMode.value = true
    refreshConflicts()
    addLog('自动识别', `生成 ${candidates.value.length} 个候选区域`)
    return { valid: true, message: `已生成 ${candidates.value.length} 个候选区域` }
  }

  function acceptCandidate(candidateId: string): ValidationResult {
    const candidate = candidates.value.find(c => c.id === candidateId)
    if (!candidate) return { valid: false, message: '候选区域不存在' }
    if (!currentScheme.value) return { valid: false, message: '请先选择切分方案' }

    const region = createRegionFromCandidate(candidate)
    region.order = getNextRegionOrder()
    region.name = getNextRegionName(candidate.category)

    const posValidation = validateRegionPosition(region.position)
    if (!posValidation.valid) return posValidation

    currentScheme.value.regions.push(region)
    currentScheme.value.updatedAt = Date.now()
    candidate.status = CandidateStatus.ACCEPTED
    candidate.matchedRegionId = region.id

    const template = templates.value.find(t => t.id === candidate.templateId)
    if (template) template.usageCount++

    addLog('采纳候选', `采纳候选区域「${candidate.templateName}」创建区域「${region.name}」(置信度 ${candidate.confidence}%)`, region.id, null, region)
    refreshConflicts()
    return { valid: true, message: '候选区域已采纳' }
  }

  function rejectCandidate(candidateId: string): ValidationResult {
    const candidate = candidates.value.find(c => c.id === candidateId)
    if (!candidate) return { valid: false, message: '候选区域不存在' }
    candidate.status = CandidateStatus.REJECTED
    addLog('拒绝候选', `拒绝候选区域「${candidate.templateName}」(置信度 ${candidate.confidence}%)`)
    return { valid: true, message: '候选区域已拒绝' }
  }

  function acceptAllCandidates(): { accepted: number; total: number } {
    let accepted = 0
    const toAccept = candidates.value.filter(
      c => c.status === CandidateStatus.PENDING && c.confidence >= confidenceThreshold.value
    )
    for (const c of toAccept) {
      const result = acceptCandidate(c.id)
      if (result.valid) accepted++
    }
    addLog('批量采纳', `批量采纳 ${accepted}/${toAccept.length} 个候选区域（置信度阈值 ${confidenceThreshold.value}%）`)
    return { accepted, total: toAccept.length }
  }

  function rejectAllCandidates(): number {
    let rejected = 0
    for (const c of candidates.value) {
      if (c.status === CandidateStatus.PENDING) {
        c.status = CandidateStatus.REJECTED
        rejected++
      }
    }
    addLog('批量拒绝', `批量拒绝 ${rejected} 个候选区域`)
    return rejected
  }

  function clearCandidates(): void {
    candidates.value = []
    isAutoRecognitionMode.value = false
  }

  function refreshConflicts(): void {
    if (!currentScheme.value) {
      conflicts.value = []
      return
    }
    conflicts.value = detectConflicts(currentScheme.value.regions)
  }

  function resolveConflict(conflictId: string): ValidationResult {
    const conflict = conflicts.value.find(c => c.id === conflictId)
    if (!conflict) return { valid: false, message: '冲突不存在' }
    conflict.resolved = true
    addLog('解决冲突', conflict.description)
    return { valid: true, message: '冲突已标记为已解决' }
  }

  function addReviewOpinion(
    regionId: string,
    decision: ReviewDecision,
    comment: string,
    proposedChanges: Partial<Region> | null = null
  ): ValidationResult {
    const region = regions.value.find(r => r.id === regionId)
    if (!region) return { valid: false, message: '区域不存在' }
    const opinion: ReviewOpinion = {
      id: uuidv4(),
      reviewer: currentAuthor.value,
      regionId,
      decision,
      comment,
      proposedChanges,
      createdAt: Date.now()
    }
    reviewOpinions.value.push(opinion)
    addLog('提交复核意见', `对区域「${region.name}」提交意见：${decision}${comment ? ' - ' + comment : ''}`, regionId)

    const regionOpinions = reviewOpinions.value.filter(o => o.regionId === regionId)
    const merged = mergeReviewOpinions(regionOpinions)
    if (merged === ReviewDecision.APPROVE) {
      updateRegion(regionId, { status: RegionStatus.REVIEWED })
    }
    return { valid: true, message: '复核意见已提交' }
  }

  function getRegionOpinions(regionId: string): ReviewOpinion[] {
    return reviewOpinions.value
      .filter(o => o.regionId === regionId)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  function getRegionMergedDecision(regionId: string): ReviewDecision {
    return mergeReviewOpinions(getRegionOpinions(regionId))
  }

  function applyOpinionChanges(opinionId: string): ValidationResult {
    const opinion = reviewOpinions.value.find(o => o.id === opinionId)
    if (!opinion) return { valid: false, message: '复核意见不存在' }
    if (!opinion.proposedChanges) return { valid: false, message: '该意见未包含修改建议' }
    const region = regions.value.find(r => r.id === opinion.regionId)
    if (!region) return { valid: false, message: '区域不存在' }
    const before = JSON.parse(JSON.stringify(region))
    const result = updateRegion(opinion.regionId, opinion.proposedChanges)
    if (result.valid) {
      addLog('应用修改建议', `应用复核人「${opinion.reviewer}」对区域「${region.name}」的修改建议`, region.id, before, opinion.proposedChanges)
    }
    return result
  }

  function finalizeRegion(regionId: string): ValidationResult {
    return updateRegion(regionId, { status: RegionStatus.FINALIZED })
  }

  function saveVersion(description: string = ''): SchemeVersion | null {
    if (!currentScheme.value) return null
    const versionNum = getNextVersionNumber(schemeVersions.value, currentScheme.value.id)
    const reviewCount = currentSchemeOpinions.value.length
    const version = createSchemeVersion(currentScheme.value, versionNum, currentAuthor.value, description, reviewCount)
    schemeVersions.value.push(version)
    addLog('保存版本', `保存版本 v${versionNum}${description ? '：' + description : ''}`)
    return version
  }

  function restoreVersion(versionId: string): ValidationResult {
    const version = schemeVersions.value.find(v => v.id === versionId)
    if (!version) return { valid: false, message: '版本不存在' }
    const schemeIdx = schemes.value.findIndex(s => s.id === version.schemeId)
    if (schemeIdx === -1) return { valid: false, message: '关联方案不存在' }
    const before = JSON.parse(JSON.stringify(schemes.value[schemeIdx]))
    schemes.value[schemeIdx] = JSON.parse(JSON.stringify(version.snapshot))
    schemes.value[schemeIdx].updatedAt = Date.now()
    refreshConflicts()
    addLog('恢复版本', `恢复到版本 v${version.versionNumber}（${version.name}）`, null, before, version.snapshot)
    return { valid: true, message: `已恢复到版本 v${version.versionNumber}` }
  }

  function deleteVersion(versionId: string): void {
    const idx = schemeVersions.value.findIndex(v => v.id === versionId)
    if (idx !== -1) {
      const v = schemeVersions.value[idx]
      schemeVersions.value.splice(idx, 1)
      addLog('删除版本', `删除版本 v${v.versionNumber}（${v.name}）`)
    }
  }

  function generateReport(): BatchReport | null {
    if (!currentScheme.value) return null
    return generateBatchReport(currentScheme.value, candidates.value, currentSchemeOpinions.value, conflicts.value)
  }

  function setReviewMode(enabled: boolean): void {
    isReviewMode.value = enabled
  }

  function setAutoRecognitionMode(enabled: boolean): void {
    isAutoRecognitionMode.value = enabled
  }

  function setShowCandidates(enabled: boolean): void {
    showCandidates.value = enabled
  }

  function setShowConflicts(enabled: boolean): void {
    showConflicts.value = enabled
  }

  function setConfidenceThreshold(value: number): void {
    confidenceThreshold.value = Math.max(0, Math.min(100, value))
  }

  function selectCandidate(candidateId: string | null): void {
    selectedCandidateId.value = candidateId
    if (candidateId) {
      selectedRegionId.value = null
    }
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
    templates,
    candidates,
    reviewOpinions,
    conflicts,
    reviewLogs,
    schemeVersions,
    isReviewMode,
    isAutoRecognitionMode,
    showCandidates,
    showConflicts,
    confidenceThreshold,
    selectedCandidateId,
    selectedCandidate,
    pendingCandidates,
    acceptedCandidates,
    unresolvedConflicts,
    currentSchemeVersions,
    currentSchemeOpinions,
    currentSchemeLogs,
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
    clearAll,
    saveTemplateFromRegion,
    deleteTemplate,
    runAutoRecognition,
    acceptCandidate,
    rejectCandidate,
    acceptAllCandidates,
    rejectAllCandidates,
    clearCandidates,
    refreshConflicts,
    resolveConflict,
    addReviewOpinion,
    getRegionOpinions,
    getRegionMergedDecision,
    applyOpinionChanges,
    finalizeRegion,
    saveVersion,
    restoreVersion,
    deleteVersion,
    generateReport,
    setReviewMode,
    setAutoRecognitionMode,
    setShowCandidates,
    setShowConflicts,
    setConfidenceThreshold,
    selectCandidate
  }
})
