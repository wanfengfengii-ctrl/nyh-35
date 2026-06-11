import {
  AlignmentMethod
} from '@/types'
import type {
  SpreadView,
  AlignmentResult,
  BreakRegion,
  BatchProcessingResult
} from '@/types'
import { autoAlignSpread } from '../spreadAlignment'
import { detectAllBreaks } from '../breakDetection'

export function batchAlignSpreads(
  spreads: SpreadView[],
  method: AlignmentMethod = AlignmentMethod.BLOCK_CENTER
): {
  results: (AlignmentResult & { updatedSpread: SpreadView })[]
  summary: BatchProcessingResult
} {
  const results: (AlignmentResult & { updatedSpread: SpreadView })[] = []
  let successCount = 0
  const details: string[] = []

  for (const spread of spreads) {
    if (spread.pages.length < 2) {
      details.push(`跳过「${spread.name}」：页面不足`)
      continue
    }
    const result = autoAlignSpread(spread, method)
    results.push(result)
    if (result.success) {
      successCount++
      details.push(`「${spread.name}」对齐成功，置信度${result.confidence}%`)
    } else {
      details.push(`「${spread.name}」对齐失败：${result.details}`)
    }
  }

  const summary: BatchProcessingResult = {
    success: successCount > 0,
    total: spreads.length,
    processed: results.length,
    failed: spreads.length - successCount,
    message: `批量对齐完成：成功 ${successCount} 个，失败 ${spreads.length - successCount} 个`,
    details
  }

  return { results, summary }
}

export function batchDetectBreaks(
  spreads: SpreadView[]
): { breaksMap: Map<string, BreakRegion[]>; summary: BatchProcessingResult } {
  const breaksMap = new Map<string, BreakRegion[]>()
  let totalBreaks = 0
  const details: string[] = []

  for (const spread of spreads) {
    if (spread.pages.length < 2) {
      details.push(`跳过「${spread.name}」：页面不足`)
      continue
    }
    const breaks = detectAllBreaks(spread)
    breaksMap.set(spread.id, breaks)
    totalBreaks += breaks.length
    details.push(`「${spread.name}」检测到 ${breaks.length} 个问题`)
  }

  const summary: BatchProcessingResult = {
    success: true,
    total: spreads.length,
    processed: spreads.length,
    failed: 0,
    message: `批量检测完成：共发现 ${totalBreaks} 个问题`,
    details
  }

  return { breaksMap, summary }
}
