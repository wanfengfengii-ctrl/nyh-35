import { describe, it, expect } from 'vitest'
import {
  validateRegionName,
  validateRegionCategory,
  validateRegionPosition,
  validateRegionOrder,
  validateSplitScheme,
  isRegionCategory
} from '@/utils/region/validators'
import type { Region, SplitScheme } from '@/types'
import { RegionCategory, RegionStatus } from '@/types'
import { v4 as uuidv4 } from 'uuid'

function makeRegion(overrides: Partial<Region> = {}): Region {
  return {
    id: uuidv4(),
    name: '正文栏-1',
    category: RegionCategory.MAIN_TEXT,
    order: 1,
    position: { x: 100, y: 100, width: 200, height: 300 },
    status: RegionStatus.PENDING,
    description: '',
    hidden: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  } as Region
}

describe('region/validators', () => {
  describe('isRegionCategory', () => {
    it('应该正确识别有效的类别', () => {
      expect(isRegionCategory('main_text')).toBe(true)
      expect(isRegionCategory('head_note')).toBe(true)
      expect(isRegionCategory('invalid')).toBe(false)
      expect(isRegionCategory('')).toBe(false)
    })
  })

  describe('validateRegionName', () => {
    it('空名称应该校验失败', () => {
      const result = validateRegionName('', null, [])
      expect(result.valid).toBe(false)
      expect(result.message).toContain('名称不能为空')
    })

    it('名称前后带空格应该校验失败', () => {
      const result = validateRegionName('   ', null, [])
      expect(result.valid).toBe(false)
    })

    it('重复名称应该校验失败', () => {
      const regions = [makeRegion({ name: '重复名称', id: 'r1' })]
      const result = validateRegionName('重复名称', null, regions)
      expect(result.valid).toBe(false)
      expect(result.message).toContain('不能重复')
    })

    it('编辑自己时名称重复应该通过', () => {
      const regions = [makeRegion({ name: '我的名称', id: 'r1' })]
      const result = validateRegionName('我的名称', 'r1', regions)
      expect(result.valid).toBe(true)
    })

    it('合法名称应该通过', () => {
      const regions = [makeRegion({ name: '区域1', id: 'r1' })]
      const result = validateRegionName('区域2', null, regions)
      expect(result.valid).toBe(true)
    })
  })

  describe('validateRegionCategory', () => {
    it('无效类别应该校验失败', () => {
      const result = validateRegionCategory('invalid_cat' as any)
      expect(result.valid).toBe(false)
      expect(result.message).toContain('类别')
    })

    it('有效类别应该通过', () => {
      const result = validateRegionCategory(RegionCategory.MAIN_TEXT)
      expect(result.valid).toBe(true)
    })
  })

  describe('validateRegionPosition', () => {
    it('宽高为0应该失败', () => {
      const result = validateRegionPosition({ x: 10, y: 10, width: 0, height: 100 })
      expect(result.valid).toBe(false)
    })

    it('负宽高应该失败，合法坐标应该通过', () => {
      const result = validateRegionPosition({ x: -1, y: 10, width: 0, height: 100 })
      expect(result.valid).toBe(false)
      const result2 = validateRegionPosition({ x: -1, y: 10, width: 100, height: 100 })
      expect(result2.valid).toBe(true)
    })

    it('合法位置应该通过', () => {
      const result = validateRegionPosition({ x: 0, y: 0, width: 100, height: 100 })
      expect(result.valid).toBe(true)
    })
  })

  describe('validateRegionOrder', () => {
    it('order <= 0 应该失败', () => {
      const result = validateRegionOrder(0, null, [])
      expect(result.valid).toBe(false)
    })

    it('正整数应该通过', () => {
      const result = validateRegionOrder(5, null, [])
      expect(result.valid).toBe(true)
    })
  })

  describe('validateSplitScheme', () => {
    const validImageData = 'data:image/png;base64,iVBORw0KGgo'

    it('非对象应该失败', () => {
      expect(validateSplitScheme(null).valid).toBe(false)
      expect(validateSplitScheme(undefined).valid).toBe(false)
      expect(validateSplitScheme('string').valid).toBe(false)
    })

    it('缺少必填字段应该失败', () => {
      const invalid = { id: 'x', name: 'Test' } as any
      expect(validateSplitScheme(invalid).valid).toBe(false)
    })

    it('缺少页面图像应该失败', () => {
      const scheme: any = {
        id: uuidv4(),
        name: '测试方案',
        author: '测试员',
        regions: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      const result = validateSplitScheme(scheme)
      expect(result.valid).toBe(false)
      expect(result.message).toContain('页面图像')
    })

    it('区域名称重复应该失败', () => {
      const scheme: any = {
        id: uuidv4(),
        name: '测试方案',
        author: '测试员',
        pageImageData: validImageData,
        regions: [
          makeRegion({ name: 'A', id: 'r1' }),
          makeRegion({ name: 'A', id: 'r2', order: 2 })
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      const result = validateSplitScheme(scheme)
      expect(result.valid).toBe(false)
      expect(result.message).toContain('重复')
    })

    it('合法方案应该通过', () => {
      const scheme: any = {
        id: uuidv4(),
        name: '测试方案',
        author: '测试员',
        pageImageData: validImageData,
        regions: [makeRegion({ id: 'r1', name: 'A' }), makeRegion({ id: 'r2', name: 'B', order: 2 })],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      const result = validateSplitScheme(scheme)
      expect(result.valid).toBe(true)
    })
  })
})
