import ePub, { EpubCFI } from 'libs/epub.js'
import { BookConfig } from '@/types/book'
import { ReaderProgressHandler } from '@/services/reader/formatTypes'
import { logWarn } from '@/utils/logger'

export interface EpubProgressSnapshot {
  durChapterIndex: number
  durChapterPos: number
  durChapterTitle: string
  durChapterTime: number
}

type EpubProgressLike = Partial<EpubProgressSnapshot>

const normalizeChapterKey = (value?: string): string => {
  return (value || '').split('#')[0]
}

const flattenToc = (items: any[] = []): any[] => {
  return items.flatMap((item) => [item, ...flattenToc(item.subitems || [])])
}

export const resolveEpubTocLabel = (tocItems: any[] = [], href?: string): string | undefined => {
  if (!href) {
    return undefined
  }

  const normalizedHref = normalizeChapterKey(href)
  return flattenToc(tocItems).find((item) => normalizeChapterKey(item.href) === normalizedHref)?.label
}

const resolveTocHref = (tocItems: any[] = [], title?: string): string | undefined => {
  if (!title) {
    return undefined
  }

  const item = flattenToc(tocItems).find((entry) => entry.label === title)
  return item?.href
}

const getSectionRoot = (section: any): Element | null => {
  return section?.document?.body || section?.contents || section?.document?.documentElement || null
}

const getPrefixTextLength = (section: any, targetRange: Range): number => {
  const doc = section?.document as Document | undefined
  const root = getSectionRoot(section)
  if (!doc || !root) {
    return 0
  }

  const range = doc.createRange()
  range.selectNodeContents(root)
  range.setEnd(targetRange.startContainer, targetRange.startOffset)
  return range.toString().length
}

const createRangeFromChapterOffset = (section: any, chapterOffset: number): Range | null => {
  const doc = section?.document as Document | undefined
  const root = getSectionRoot(section)
  if (!doc || !root) {
    return null
  }

  const safeOffset = Math.max(0, Math.floor(chapterOffset))
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let remaining = safeOffset
  let lastTextNode: Node | null = null
  let currentNode = walker.nextNode()

  while (currentNode) {
    const textLength = currentNode.textContent?.length || 0
    lastTextNode = currentNode

    if (remaining <= textLength) {
      const range = doc.createRange()
      range.setStart(currentNode, remaining)
      range.collapse(true)
      return range
    }

    remaining -= textLength
    currentNode = walker.nextNode()
  }

  const range = doc.createRange()
  if (lastTextNode) {
    const endOffset = lastTextNode.textContent?.length || 0
    range.setStart(lastTextNode, endOffset)
  } else {
    range.setStart(root, 0)
  }
  range.collapse(true)
  return range
}

const loadSection = async (book: any, target: string | number) => {
  const section = book?.section?.(target)
  if (!section) {
    return null
  }

  await section.load(book.load.bind(book))
  return section
}

const resolveSectionFromSnapshot = async (
  book: any,
  snapshot: EpubProgressLike
): Promise<any | null> => {
  const tocItems = book?.navigation?.toc || []
  let section = Number.isInteger(snapshot.durChapterIndex)
    ? await loadSection(book, snapshot.durChapterIndex as number)
    : null

  const tocHref = resolveTocHref(tocItems, snapshot.durChapterTitle)
  const targetHref =
    tocHref ||
    (snapshot.durChapterTitle && snapshot.durChapterTitle.includes('/')
      ? snapshot.durChapterTitle
      : undefined)

  if (targetHref) {
    const normalizedTargetHref = normalizeChapterKey(targetHref)
    const sectionHref = normalizeChapterKey(section?.href)
    if (!section || sectionHref !== normalizedTargetHref) {
      const matchedByHref = await loadSection(book, targetHref)
      if (matchedByHref) {
        section = matchedByHref
      }
    }
  }

  return section
}

export const isEpubProgressSnapshot = (
  bookConfig: Partial<BookConfig>
): bookConfig is Partial<BookConfig> & EpubProgressLike => {
  return (
    typeof bookConfig.durChapterIndex === 'number' &&
    typeof bookConfig.durChapterPos === 'number'
  )
}

export const toEpubProgressSnapshot = (
  bookConfig: Partial<BookConfig>
): EpubProgressSnapshot | null => {
  if (!isEpubProgressSnapshot(bookConfig)) {
    return null
  }

  const durChapterIndex = bookConfig.durChapterIndex ?? 0
  const durChapterPos = bookConfig.durChapterPos ?? 0

  return {
    durChapterIndex,
    durChapterPos,
    durChapterTitle: bookConfig.durChapterTitle || '',
    durChapterTime:
      typeof bookConfig.durChapterTime === 'number' ? bookConfig.durChapterTime : Date.now(),
  }
}

export const serializeEpubProgress = async (rendition: any): Promise<EpubProgressSnapshot | null> => {
  const currentLocation = await Promise.resolve(rendition?.currentLocation?.())
  const cfi = currentLocation?.start?.cfi
  const book = rendition?.book

  if (!cfi || !book) {
    return null
  }

  await book.ready
  const parsedCfi = new EpubCFI(cfi)
  const section = await loadSection(book, parsedCfi.spinePos)
  if (!section?.document) {
    return null
  }

  const range = parsedCfi.toRange(section.document)
  if (!range) {
    return null
  }

  const href = section.href || currentLocation?.start?.href || ''

  return {
    durChapterIndex: parsedCfi.spinePos,
    durChapterPos: getPrefixTextLength(section, range),
    durChapterTitle: resolveEpubTocLabel(book.navigation?.toc, href) || href,
    durChapterTime: Date.now(),
  }
}

export const resolveEpubDisplayTarget = async (
  book: any,
  snapshot: EpubProgressLike
): Promise<string | undefined> => {
  if (!isEpubProgressSnapshot(snapshot)) {
    return undefined
  }

  await book.ready
  const section = await resolveSectionFromSnapshot(book, snapshot)
  if (!section) {
    return undefined
  }

  const range = createRangeFromChapterOffset(section, snapshot.durChapterPos || 0)
  if (!range) {
    return section.href
  }

  try {
    return section.cfiFromRange(range)
  } catch (error) {
    logWarn('epubProgress', '根据 EPUB 进度快照恢复 CFI 失败', error)
    return section.href
  }
}

export const calculateEpubProgressFromSnapshot = async (
  bookData: Uint8Array,
  snapshot: EpubProgressLike,
  cachedLocations?: string
): Promise<number> => {
  if (!cachedLocations || !isEpubProgressSnapshot(snapshot)) {
    return 0
  }

  const arrayBuffer = bookData.buffer.slice(
    bookData.byteOffset,
    bookData.byteOffset + bookData.byteLength
  ) as ArrayBuffer
  const book = ePub(arrayBuffer)

  try {
    await book.ready
    const cfi = await resolveEpubDisplayTarget(book, snapshot)
    if (!cfi) {
      return 0
    }

    book.locations.load(cachedLocations)
    return book.locations.percentageFromCfi(cfi) * 100
  } catch (error) {
    logWarn('epubProgress', '根据 EPUB 进度快照计算进度失败', error)
    return 0
  } finally {
    try {
      book.destroy?.()
    } catch (error) {
      logWarn('epubProgress', '销毁 EPUB 进度快照实例失败', error)
    }
  }
}

const clampProgress = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, value))
}

export const epubReaderProgressHandler: ReaderProgressHandler = {
  async serializeProgress({ rendition }) {
    return await serializeEpubProgress(rendition)
  },
  async resolveDisplayTarget(source, snapshot) {
    return await resolveEpubDisplayTarget(source, snapshot)
  },
  async calculateProgress({ rendition }) {
    const currentLocation = await Promise.resolve(rendition?.currentLocation?.())
    const percentage = currentLocation?.start?.percentage
    return typeof percentage === 'number' ? clampProgress(percentage * 100) : 0
  },
  async calculateShelfProgress({ bookData, snapshot, cache }) {
    if (!bookData) {
      return 0
    }

    return await calculateEpubProgressFromSnapshot(bookData, snapshot, cache.locations)
  },
}
