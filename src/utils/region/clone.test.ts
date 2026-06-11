import { describe, it, expect } from 'vitest'
import { cloneSplitScheme } from '@/utils/region/clone'
import type { SplitScheme, Region } from '@/types'
import { RegionCategory, RegionStatus } from '@/types'
import { v4 as uuidv4 } from 'uuid'

function makeRegion(overrides: Partial<Region> = {}): Region {
  return {
    id: uuidv4(),
    name: '测试区域',
    category: RegionCategory.MAIN_TEXT,
    order: 1,
    position: { x: 10, y: 20, width: 100, height: 200 },
    status: RegionStatus.PENDING,
    description: '描述',
    hidden: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  } as Region
}

describe('region/clone', () => {
  describe('cloneSplitScheme', () => {
    const validImage = 'data:image/png;base64,xxx'

    it('应该生成一个完全独立的拷贝', () => {
      const original: SplitScheme = {
        id: 'scheme-1',
        name: '原方案',
        author: '作者A',
        description: '详细描述',
        pageImageData: validImage,
        regions: [makeRegion({ id: 'r1', name: '区域1' })],
        createdAt: 1000,
        updatedAt: 2000
      }

      const cloned = cloneSplitScheme(original)

      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)

      cloned.name = '修改后方案'
      expect(original.name).toBe('原方案')
    })

    it('应该深拷贝 regions 数组中的每个对象', () => {
      const region = makeRegion({ id: 'r1', name: '原区域名' })
      const original: SplitScheme = {
        id: 's1',
        name: 'S',
        author: 'A',
        description: '',
        pageImageData: validImage,
        regions: [region],
        createdAt: 0,
        updatedAt: 0
      }

      const cloned = cloneSplitScheme(original)

      cloned.regions[0].name = '修改后的区域名'
      cloned.regions[0].position.x = 999

      expect(original.regions[0].name).toBe('原区域名')
      expect(original.regions[0].position.x).toBe(10)
    })

    it('应该拷贝所有属性', () => {
      const original: SplitScheme = {
        id: 'full-id',
        name: '完整方案',
        author: '张三',
        description: '详细描述',
        regions: [
          makeRegion({ id: 'r1', order: 1 }),
          makeRegion({ id: 'r2', order: 2 })
        ],
        createdAt: 111,
        updatedAt: 222
      }

      const cloned = cloneSplitScheme(original)

      expect(cloned.id).toBe('full-id')
      expect(cloned.name).toBe('完整方案')
      expect(cloned.author).toBe('张三')
      expect(cloned.description).toBe('详细描述')
      expect(cloned.regions).toHaveLength(2)
      expect(cloned.regions[1].order).toBe(2)
      expect(cloned.createdAt).toBe(111)
      expect(cloned.updatedAt).toBe(222)
    })
  })
})
