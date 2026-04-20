import { BookConfig, BookProgressSnapshot } from '@/types/book'
import { BookCachePayload } from '@/services/book/bookCacheService'
import { BookLocationsCachePayload } from '@/services/book/bookLocationsCacheService'
import { isUnreadProgressSnapshot } from '@/services/book/bookConfigService'
import { epubReaderProgressHandler } from '@/services/reader/epub/epubProgressService'

export const serializeReaderProgress = async (
  rendition: any
): Promise<BookProgressSnapshot | null> => {
  return await epubReaderProgressHandler.serializeProgress({
    rendition,
  })
}

export const resolveReaderDisplayTarget = async (
  source: any,
  snapshot: BookProgressSnapshot
): Promise<string | number | undefined> => {
  return await epubReaderProgressHandler.resolveDisplayTarget(source, snapshot)
}

export const calculateShelfProgress = async (
  bookData: Uint8Array | undefined,
  snapshot: BookProgressSnapshot,
  cache: BookCachePayload,
  locationsCache?: BookLocationsCachePayload | null
): Promise<number> => {
  if (isUnreadProgressSnapshot(snapshot)) {
    return 0
  }

  return await epubReaderProgressHandler.calculateShelfProgress({
    bookData,
    snapshot,
    cache,
    locationsCache,
  })
}

export const isNormalizedProgressSnapshot = (
  value: Partial<BookConfig>
): value is BookProgressSnapshot => {
  return (
    typeof value.durChapterIndex === 'number' &&
    typeof value.durChapterPos === 'number' &&
    typeof value.durChapterTitle === 'string' &&
    typeof value.durChapterTime === 'number'
  )
}
