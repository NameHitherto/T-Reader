import type { BookConfig, BookFormat, BookProgressSnapshot } from '@/types/book'
import type { BookCachePayload } from '@/services/book/bookCacheService'

export interface ReaderFormatLoadResult {
  format: BookFormat
  bookConfig: BookConfig
  bookCache: BookCachePayload
  fileName: string
  bookData: Uint8Array
  bookArrayBuffer?: ArrayBuffer
}

export interface ReaderProgressHandler {
  serializeProgress: (args: {
    rendition: any
    txtCurrentParagraph: number
  }) => Promise<BookProgressSnapshot | null>
  resolveDisplayTarget: (
    source: any,
    snapshot: BookProgressSnapshot
  ) => Promise<string | number | undefined>
  calculateProgress: (args: {
    rendition: any
    bookConfig: Pick<BookConfig, 'durChapterIndex'>
    txtCurrentParagraph: number
    bookCache: BookCachePayload | null
  }) => Promise<number>
  calculateShelfProgress: (args: {
    bookData: Uint8Array | undefined
    snapshot: BookProgressSnapshot
    cache: BookCachePayload
  }) => Promise<number>
}
