import { BookConfig } from '@/js/map'
import { BookFormat } from '@/js/bookFormat'
import {
  ensureBookCache,
  loadBookBinary,
  loadBookConfig,
} from '@/services/book/bookRepository'
import { BookCachePayload } from '@/services/book/bookCacheService'

export interface ReaderLoadResult {
  bookConfig: BookConfig
  bookCache: BookCachePayload
  format: BookFormat
  bookData: Uint8Array
  bookArrayBuffer: ArrayBuffer
}

export const loadReaderBookData = async (bookId: string): Promise<ReaderLoadResult> => {
  const bookConfig = await loadBookConfig(bookId)
  const [bookCache, loadedBook] = await Promise.all([
    ensureBookCache(bookConfig),
    loadBookBinary(bookConfig),
  ])
  const bookArrayBuffer = loadedBook.bookData.buffer.slice(
    loadedBook.bookData.byteOffset,
    loadedBook.bookData.byteOffset + loadedBook.bookData.byteLength
  ) as ArrayBuffer

  return {
    bookConfig,
    bookCache,
    format: loadedBook.format,
    bookData: loadedBook.bookData,
    bookArrayBuffer,
  }
}
