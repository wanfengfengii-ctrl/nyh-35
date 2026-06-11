import type { SplitScheme, Region } from '@/types'

export function cloneSplitScheme(scheme: SplitScheme): SplitScheme {
  return {
    id: scheme.id,
    name: scheme.name,
    author: scheme.author,
    description: scheme.description,
    createdAt: scheme.createdAt,
    updatedAt: scheme.updatedAt,
    pageImageData: scheme.pageImageData,
    regions: scheme.regions.map((r: Region) => ({
      ...r,
      position: { ...r.position }
    }))
  }
}
