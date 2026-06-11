import { v4 as uuidv4 } from 'uuid'
import {
  BookStatus,
  SpreadLayout,
  ProofreadingStatus
} from '@/types'
import type {
  Book,
  BookSpread,
  SpreadView,
  PageImage,
  SplitScheme
} from '@/types'
import { createSpreadView, addPageToSpread } from '../spreadAlignment'

export function createBook(
  name: string,
  author: string,
  totalPages: number,
  startPage: number = 1,
  endPage?: number,
  layout: SpreadLayout = SpreadLayout.RIGHT_LEFT,
  description: string = ''
): Book {
  return {
    id: uuidv4(),
    name,
    author,
    description,
    totalPages,
    status: BookStatus.NOT_STARTED,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    startPage,
    endPage: endPage || totalPages,
    layout,
    pageGap: 20
  }
}

export function generateBookSpreads(
  book: Book,
  pageImages: PageImage[],
  schemes: Map<string, SplitScheme> = new Map()
): { spreads: SpreadView[]; bookSpreads: BookSpread[] } {
  const spreadViews: SpreadView[] = []
  const bookSpreads: BookSpread[] = []
  const actualEnd = Math.min(book.endPage, book.totalPages)
  const spreadCount = Math.ceil((actualEnd - book.startPage + 1) / 2)

  for (let i = 0; i < spreadCount; i++) {
    const leftPageIdx = book.startPage + i * 2 - 1
    const rightPageIdx = leftPageIdx + 1

    const spreadName = `第${leftPageIdx}-${rightPageIdx}页跨页`
    const spread = createSpreadView(spreadName, book.layout, book.pageGap)

    const leftImage = pageImages[leftPageIdx] || pageImages[i * 2]
    const rightImage = pageImages[rightPageIdx] || pageImages[i * 2 + 1]

    if (leftImage) {
      const leftScheme = schemes.get(leftImage.id) || null
      addPageToSpread(spread, leftImage, leftScheme)
    }
    if (rightImage) {
      const rightScheme = schemes.get(rightImage.id) || null
      addPageToSpread(spread, rightImage, rightScheme)
    }

    spreadViews.push(spread)

    const bookSpread: BookSpread = {
      id: uuidv4(),
      bookId: book.id,
      spreadId: spread.id,
      leftPageIndex: i * 2,
      rightPageIndex: i * 2 + 1,
      sequence: i + 1,
      alignmentConfidence: 0,
      breakCount: 0,
      resolvedBreakCount: 0,
      proofreadingStatus: ProofreadingStatus.NOT_STARTED,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    bookSpreads.push(bookSpread)
  }

  return { spreads: spreadViews, bookSpreads: bookSpreads }
}

export function inheritAdjacentScheme(
  targetScheme: SplitScheme,
  sourceScheme: SplitScheme,
  _direction: 'left' | 'right' = 'right'
): SplitScheme {
  const cloned: SplitScheme = {
    id: uuidv4(),
    name: targetScheme.name,
    author: targetScheme.author,
    createdAt: targetScheme.createdAt,
    updatedAt: Date.now(),
    pageImageData: targetScheme.pageImageData,
    regions: targetScheme.regions.map((r) => ({ ...r, id: uuidv4() }))
  }

  const sourceMainRegions = sourceScheme.regions.filter(
    (r) => !r.hidden && r.position
  )

  if (sourceMainRegions.length === 0) return cloned

  const avgY =
    sourceMainRegions.reduce((sum, r) => sum + r.position.y, 0) /
    sourceMainRegions.length
  const avgHeight =
    sourceMainRegions.reduce((sum, r) => sum + r.position.height, 0) /
    sourceMainRegions.length

  cloned.regions = cloned.regions.map((r) => ({
    ...r,
    position: {
      ...r.position,
      y: Math.round(avgY - avgHeight / 2 + r.position.height / 2)
    }
  }))

  return cloned
}
