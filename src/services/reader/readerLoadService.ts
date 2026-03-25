import { BookConfig } from '@/js/map'
import { BookFormat } from '@/js/bookFormat'
import {
  loadBookBinary,
  loadBookCacheByConfig,
  loadBookConfig,
} from '@/services/book/bookRepository'
import { BookCachePayload } from '@/services/book/bookCacheService'

export interface ReaderLoadResult {
  bookConfig: BookConfig
  bookCache: BookCachePayload | null
  format: BookFormat
  bookData: Uint8Array
  bookArrayBuffer: ArrayBuffer
}

export const loadReaderBookData = async (bookId: string): Promise<ReaderLoadResult> => {
  const bookConfig = await loadBookConfig(bookId)
  const bookCache = await loadBookCacheByConfig(bookConfig)
  const format = (bookConfig.format || 'epub') as BookFormat
  const bookData = await loadBookBinary(bookId, format)
  const bookArrayBuffer = bookData.buffer.slice(
    bookData.byteOffset,
    bookData.byteOffset + bookData.byteLength
  ) as ArrayBuffer

  return {
    bookConfig,
    bookCache,
    format,
    bookData,
    bookArrayBuffer,
  }
}
