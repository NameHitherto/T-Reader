import type { BookConfig, BookFormat, BookProgressSnapshot } from '@/types/book'
import type { BookLocationsCachePayload } from '@/services/book/bookLocationsCacheService'
import type { EpubBookLike, EpubRenditionLike } from '@/types/epub'

export interface ReaderFormatLoadResult {
  format: BookFormat
  bookConfig: BookConfig
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
    snapshot: BookProgressSnapshot,
  ) => Promise<string | number | undefined>
  calculateProgress: (args: {
    rendition: EpubRenditionLike | null
    bookConfig: Pick<BookConfig, 'durChapterIndex'>
  }) => Promise<number>
  calculateShelfProgress: (args: {
    bookData: Uint8Array | undefined
    snapshot: BookProgressSnapshot
    locationsCache?: BookLocationsCachePayload | null
  }) => Promise<number>
}
