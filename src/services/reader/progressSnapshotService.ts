import { BookProgressSnapshot } from '@/types/book'
import { BookCachePayload } from '@/services/book/bookCacheService'
import { BookLocationsCachePayload } from '@/services/book/bookLocationsCacheService'
import { isUnreadProgressSnapshot } from '@/services/book/bookConfigService'
import { epubReaderProgressHandler } from '@/services/reader/epub/epubProgressService'
import type { EpubBookLike, EpubRenditionLike } from '@/types/epub'

export const serializeReaderProgress = async (
  rendition: EpubRenditionLike | null,
): Promise<BookProgressSnapshot | null> => {
  return await epubReaderProgressHandler.serializeProgress({
    rendition,
  })
}

export const resolveReaderDisplayTarget = async (
  source: EpubBookLike,
  snapshot: BookProgressSnapshot,
): Promise<string | number | undefined> => {
  return await epubReaderProgressHandler.resolveDisplayTarget(source, snapshot)
}

export const calculateShelfProgress = async (
  bookData: Uint8Array | undefined,
  snapshot: BookProgressSnapshot,
  cache: BookCachePayload,
  locationsCache?: BookLocationsCachePayload | null,
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
