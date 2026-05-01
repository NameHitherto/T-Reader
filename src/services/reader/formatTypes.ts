import type { BookConfig, BookFormat, BookProgressSnapshot } from '@/types/book'
import type { BookCachePayload } from '@/services/book/bookCacheService'
import type { BookLocationsCachePayload } from '@/services/book/bookLocationsCacheService'
import type { EpubBookLike, EpubRenditionLike } from '@/types/epub'

export interface ReaderFormatLoadResult {
  format: BookFormat
  bookConfig: BookConfig
  bookCache: BookCachePayload
  bookLocationsCache: BookLocationsCachePayload | null
  fileName: string
  bookData: Uint8Array
  bookArrayBuffer?: ArrayBuffer
}

export interface ReaderProgressHandler {
  serializeProgress: (args: {
    rendition: EpubRenditionLike | null
  }) => Promise<BookProgressSnapshot | null>
  resolveDisplayTarget: (
    source: EpubBookLike,
    snapshot: BookProgressSnapshot
  ) => Promise<string | number | undefined>
  calculateProgress: (args: {
    rendition: EpubRenditionLike | null
    bookConfig: Pick<BookConfig, 'durChapterIndex'>
    bookCache: BookCachePayload | null
  }) => Promise<number>
  calculateShelfProgress: (args: {
    bookData: Uint8Array | undefined
    snapshot: BookProgressSnapshot
    cache: BookCachePayload
    locationsCache?: BookLocationsCachePayload | null
  }) => Promise<number>
}
