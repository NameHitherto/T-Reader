import ePub, { EpubCFI } from 'libs/epub.js'
import { BookConfig } from '@/services/book/types'
import { logInfo, logWarn } from '@/utils/logger'
import {
  calculateLegadoOffset,
  createRangeFromLegadoOffset,
} from '@/services/reader/legadoFormatter'
import type {
  EpubBookLike,
  EpubLocationLike,
  EpubSectionLike,
  EpubTocItem,
  EpubRenditionLike,
} from '@/services/reader/epubTypes'

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

const flattenToc = (items: EpubTocItem[] = []): EpubTocItem[] => {
  return items.flatMap((item) => [item, ...flattenToc(item.subitems || [])])
}

export const resolveEpubTocLabel = (
  tocItems: EpubTocItem[] = [],
  href?: string,
): string | undefined => {
  if (!href) {
    return undefined
  }

  const normalizedHref = normalizeChapterKey(href)

  return flattenToc(tocItems).find((item) => normalizeChapterKey(item.href) === normalizedHref)
    ?.label
}

const resolveTocHref = (tocItems: EpubTocItem[] = [], title?: string): string | undefined => {
  if (!title) {
    return undefined
  }

  const item = flattenToc(tocItems).find((entry) => entry.label === title)

  return item?.href
}

const loadSection = async (
  book: EpubBookLike,
  target: string | number,
): Promise<EpubSectionLike | null> => {
  const section = typeof target === 'number' ? book?.section?.(target) : book?.section?.(target)
  if (!section) {
    return null
  }

  if (!book.load) {
    return null
  }

  await section.load(book.load.bind(book))
  return section
}

const resolveSectionFromSnapshot = async (
  book: EpubBookLike,
  snapshot: EpubProgressLike,
): Promise<EpubSectionLike | null> => {
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
  bookConfig: Partial<BookConfig>,
): bookConfig is Partial<BookConfig> & EpubProgressLike => {
  return (
    typeof bookConfig.durChapterIndex === 'number' && typeof bookConfig.durChapterPos === 'number'
  )
}

export const toEpubProgressSnapshot = (
  bookConfig: Partial<BookConfig>,
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

export const serializeEpubProgress = async (
  rendition: EpubRenditionLike | null,
): Promise<EpubProgressSnapshot | null> => {
  const currentLocation = await Promise.resolve<EpubLocationLike | undefined>(
    rendition?.currentLocation?.(),
  )
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
  const durChapterIndex = parsedCfi.spinePos
  const durChapterPos = calculateLegadoOffset(section, range)
  const durChapterTitle = resolveEpubTocLabel(book.navigation?.toc, href) || href

  logInfo('epub-progress', 'save-progress', {
    sourceCfi: cfi,
    durChapterIndex,
    durChapterPos,
    durChapterTitle,
  })

  return {
    durChapterIndex,
    durChapterPos,
    durChapterTitle,
    durChapterTime: Date.now(),
  }
}

export const resolveEpubDisplayTarget = async (
  book: EpubBookLike,
  snapshot: EpubProgressLike,
): Promise<string | undefined> => {
  if (!isEpubProgressSnapshot(snapshot)) {
    return undefined
  }

  await book.ready
  const section = await resolveSectionFromSnapshot(book, snapshot)
  if (!section) {
    return undefined
  }

  const range = createRangeFromLegadoOffset(section, snapshot.durChapterPos || 0)
  if (!range) {
    return section.href
  }

  try {
    const target = section.cfiFromRange(range)
    logInfo('epub-progress', 'restore-progress', {
      snapshot,
      target,
    })
    return target
  } catch (error) {
    logWarn('epub-progress', 'restore-cfi-failed', error)
    logInfo('epub-progress', 'restore-progress fallback-to-href', {
      snapshot,
      target: section.href,
    })
    return section.href
  }
}

export const calculateEpubProgressFromSnapshot = async (
  bookData: Uint8Array,
  snapshot: EpubProgressLike,
  cachedLocations?: string,
): Promise<number> => {
  if (!cachedLocations || !isEpubProgressSnapshot(snapshot)) {
    return 0
  }

  const arrayBuffer = bookData.buffer.slice(
    bookData.byteOffset,
    bookData.byteOffset + bookData.byteLength,
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
    logWarn('epub-progress', 'calculate-progress-failed', error)
    return 0
  } finally {
    try {
      book.destroy?.()
    } catch (error) {
      logWarn('epub-progress', 'destroy-snapshot-instance-failed', error)
    }
  }
}

const clampProgress = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, value))
}

export const calculateEpubProgress = async (
  rendition: EpubRenditionLike | null,
): Promise<number> => {
  const currentLocation = await Promise.resolve(rendition?.currentLocation?.())
  const percentage = currentLocation?.start?.percentage

  return typeof percentage === 'number' ? clampProgress(percentage * 100) : 0
}
