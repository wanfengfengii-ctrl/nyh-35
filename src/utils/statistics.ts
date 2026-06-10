import { Region, SchemeStats, RegionStat, RegionCategory } from '@/types'

export function calculateRegionArea(region: Region): number {
  return region.position.width * region.position.height
}

export function calculateSchemeStats(
  regions: Region[],
  pageWidth: number,
  pageHeight: number
): SchemeStats {
  const pageArea = pageWidth * pageHeight

  const visibleRegions = regions.filter((r) => !r.hidden)

  const statsByCategoryMap = new Map<RegionCategory, RegionStat>()
  for (const category of Object.values(RegionCategory)) {
    statsByCategoryMap.set(category, {
      category,
      count: 0,
      area: 0,
      areaRatio: 0
    })
  }

  let totalArea = 0
  let visibleArea = 0

  for (const region of regions) {
    const area = calculateRegionArea(region)
    totalArea += area

    const stat = statsByCategoryMap.get(region.category)!
    if (!region.hidden) {
      stat.count += 1
      stat.area += area
      visibleArea += area
    }
  }

  const statsByCategory: RegionStat[] = []
  for (const stat of statsByCategoryMap.values()) {
    if (stat.count > 0) {
      stat.areaRatio = pageArea > 0 ? (stat.area / pageArea) * 100 : 0
      statsByCategory.push(stat)
    }
  }

  statsByCategory.sort((a, b) => b.area - a.area)

  return {
    totalRegions: regions.length,
    visibleRegions: visibleRegions.length,
    totalArea,
    visibleArea,
    statsByCategory
  }
}
