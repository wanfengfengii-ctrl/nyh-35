import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import {
  ReviewOpinion,
  ReviewDecision,
  ReviewLogEntry,
  SchemeVersion,
  BatchReport,
  Region,
  RegionStatus
} from '@/types'
import { createReviewLog, createSchemeVersion, getNextVersionNumber, generateBatchReport } from '@/utils/reviewUtils'
import { mergeReviewOpinions } from '@/utils/semiAuto'
import { useRegionStore } from './region'

export interface ReviewDeps {
  getCurrentSchemeId?: () => string | null
  getCurrentScheme?: () => any
  getRegions?: () => Region[]
  getCandidates?: () => any[]
  getConflicts?: () => any[]
  getSchemes?: () => any[]
  updateRegion?: (regionId: string, changes: Partial<Region>) => { valid: boolean; message: string }
  refreshConflicts?: () => void
}

export const useReviewStore = defineStore('review', () => {
  const reviewOpinions = ref<ReviewOpinion[]>([])
  const reviewLogs = ref<ReviewLogEntry[]>([])
  const schemeVersions = ref<SchemeVersion[]>([])
  const isReviewMode = ref(false)

  function getDefaultDeps(): Required<ReviewDeps> {
    const regionStore = useRegionStore()
    return {
      getCurrentSchemeId: () => regionStore.currentSchemeId,
      getCurrentScheme: () => regionStore.currentScheme,
      getRegions: () => regionStore.regions as Region[],
      getCandidates: () => regionStore.candidates,
      getConflicts: () => regionStore.conflicts,
      getSchemes: () => regionStore.schemes,
      updateRegion: (id, changes) => regionStore.updateRegion(id, changes),
      refreshConflicts: () => regionStore.refreshConflicts()
    }
  }

  function withDeps(deps?: Partial<ReviewDeps>): Required<ReviewDeps> {
    return { ...getDefaultDeps(), ...deps }
  }

  const currentSchemeVersions = computed(() => {
    const d = getDefaultDeps()
    return schemeVersions.value
      .filter((v) => v.schemeId === d.getCurrentSchemeId())
      .sort((a, b) => b.versionNumber - a.versionNumber)
  })

  const currentSchemeOpinions = computed(() => {
    const d = getDefaultDeps()
    const scheme = d.getCurrentScheme()
    if (!scheme) return []
    return reviewOpinions.value.filter((o) =>
      scheme.regions.some((r: Region) => r.id === o.regionId)
    )
  })

  const currentSchemeLogs = computed(() => {
    const d = getDefaultDeps()
    return reviewLogs.value
      .filter((l) => l.schemeId === d.getCurrentSchemeId())
      .sort((a, b) => b.timestamp - a.timestamp)
  })

  function addLog(
    action: string,
    details: string,
    regionId: string | null = null,
    before: unknown | null = null,
    after: unknown | null = null,
    author: string = '整理员',
    deps?: Partial<ReviewDeps>
  ): void {
    const d = withDeps(deps)
    const schemeId = d.getCurrentSchemeId()
    if (!schemeId) return
    reviewLogs.value.push(
      createReviewLog(author, action, schemeId, details, regionId, before, after)
    )
  }

  function addReviewOpinion(
    regionId: string,
    decision: ReviewDecision,
    comment: string,
    proposedChanges: Partial<Region> | null = null,
    author: string = '整理员',
    deps?: Partial<ReviewDeps>
  ): { valid: boolean; message: string; result?: ReviewOpinion } {
    const d = withDeps(deps)
    const region = d.getRegions().find((r) => r.id === regionId)
    if (!region) return { valid: false, message: '区域不存在' }

    const opinion: ReviewOpinion = {
      id: uuidv4(),
      reviewer: author,
      regionId,
      decision,
      comment,
      proposedChanges,
      createdAt: Date.now()
    }
    reviewOpinions.value.push(opinion)
    addLog(
      '提交复核意见',
      `对区域「${region.name}」提交意见：${decision}${comment ? ' - ' + comment : ''}`,
      regionId,
      null,
      null,
      author,
      deps
    )

    const regionOpinions = reviewOpinions.value.filter((o) => o.regionId === regionId)
    const merged = mergeReviewOpinions(regionOpinions)
    if (merged === ReviewDecision.APPROVE) {
      d.updateRegion(regionId, { status: RegionStatus.REVIEWED })
    }
    return { valid: true, message: '复核意见已提交', result: opinion }
  }

  function getRegionOpinions(regionId: string): ReviewOpinion[] {
    return reviewOpinions.value
      .filter((o) => o.regionId === regionId)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  function getRegionMergedDecision(regionId: string): ReviewDecision {
    return mergeReviewOpinions(getRegionOpinions(regionId))
  }

  function applyOpinionChanges(
    opinionId: string,
    author: string = '整理员',
    deps?: Partial<ReviewDeps>
  ): { valid: boolean; message: string } {
    const d = withDeps(deps)
    const opinion = reviewOpinions.value.find((o) => o.id === opinionId)
    if (!opinion) return { valid: false, message: '复核意见不存在' }
    if (!opinion.proposedChanges) return { valid: false, message: '该意见未包含修改建议' }
    const region = d.getRegions().find((r) => r.id === opinion.regionId)
    if (!region) return { valid: false, message: '区域不存在' }
    const before = JSON.parse(JSON.stringify(region))
    const result = d.updateRegion(opinion.regionId, opinion.proposedChanges)
    if (result.valid) {
      addLog(
        '应用修改建议',
        `应用复核人「${opinion.reviewer}」对区域「${region.name}」的修改建议`,
        region.id,
        before,
        opinion.proposedChanges,
        author,
        deps
      )
    }
    return result
  }

  function finalizeRegion(
    regionId: string,
    deps?: Partial<ReviewDeps>
  ): { valid: boolean; message: string } {
    const d = withDeps(deps)
    return d.updateRegion(regionId, { status: RegionStatus.FINALIZED })
  }

  function saveVersion(
    description: string = '',
    author: string = '整理员',
    deps?: Partial<ReviewDeps>
  ): SchemeVersion | null {
    const d = withDeps(deps)
    const scheme = d.getCurrentScheme()
    if (!scheme) return null
    const versionNum = getNextVersionNumber(schemeVersions.value, scheme.id)
    const version = createSchemeVersion(
      scheme,
      versionNum,
      author,
      description,
      currentSchemeOpinions.value.length
    )
    schemeVersions.value.push(version)
    addLog(
      '保存版本',
      `保存版本 v${versionNum}${description ? '：' + description : ''}`,
      null,
      null,
      null,
      author,
      deps
    )
    return version
  }

  function restoreVersion(
    versionId: string,
    author: string = '整理员',
    deps?: Partial<ReviewDeps>
  ): { valid: boolean; message: string } {
    const d = withDeps(deps)
    const version = schemeVersions.value.find((v) => v.id === versionId)
    if (!version) return { valid: false, message: '版本不存在' }
    const schemes = d.getSchemes()
    const schemeIdx = schemes.findIndex((s) => s.id === version.schemeId)
    if (schemeIdx === -1) return { valid: false, message: '关联方案不存在' }
    const before = JSON.parse(JSON.stringify(schemes[schemeIdx]))
    schemes[schemeIdx] = JSON.parse(JSON.stringify(version.snapshot))
    schemes[schemeIdx].updatedAt = Date.now()
    d.refreshConflicts()
    addLog(
      '恢复版本',
      `恢复到版本 v${version.versionNumber}（${version.name}）`,
      null,
      before,
      version.snapshot,
      author,
      deps
    )
    return { valid: true, message: `已恢复到版本 v${version.versionNumber}` }
  }

  function deleteVersion(
    versionId: string,
    author: string = '整理员',
    deps?: Partial<ReviewDeps>
  ): void {
    const idx = schemeVersions.value.findIndex((v) => v.id === versionId)
    if (idx !== -1) {
      const v = schemeVersions.value[idx]
      schemeVersions.value.splice(idx, 1)
      addLog('删除版本', `删除版本 v${v.versionNumber}（${v.name}）`, null, null, null, author, deps)
    }
  }

  function generateReport(
    deps?: Partial<ReviewDeps>
  ): BatchReport | null {
    const d = withDeps(deps)
    const scheme = d.getCurrentScheme()
    if (!scheme) return null
    return generateBatchReport(
      scheme,
      d.getCandidates(),
      currentSchemeOpinions.value,
      d.getConflicts()
    )
  }

  function setReviewMode(enabled: boolean): void {
    isReviewMode.value = enabled
  }

  function clearReviewData(): void {
    reviewOpinions.value = []
    reviewLogs.value = []
    schemeVersions.value = []
    isReviewMode.value = false
  }

  return {
    reviewOpinions,
    reviewLogs,
    schemeVersions,
    isReviewMode,
    currentSchemeVersions,
    currentSchemeOpinions,
    currentSchemeLogs,
    addLog,
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
    clearReviewData
  }
})
