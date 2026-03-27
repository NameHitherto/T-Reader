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
  fileName: string
  bookData: Uint8Array
  bookArrayBuffer: ArrayBuffer
}

export const loadReaderBookData = async (bookKey: string): Promise<ReaderLoadResult> => {
  const bookConfig = await loadBookConfig(bookKey)
  const [bookCache, loadedBook] = await Promise.all([
    ensureBookCache(bookKey),
    loadBookBinary(bookKey),
  ])
  const bookArrayBuffer = loadedBook.bookData.buffer.slice(
    loadedBook.bookData.byteOffset,
    loadedBook.bookData.byteOffset + loadedBook.bookData.byteLength
  ) as ArrayBuffer

  return {
    bookConfig,
    bookCache,
    format: loadedBook.format,
    fileName: loadedBook.fileName,
    bookData: loadedBook.bookData,
    bookArrayBuffer,
  }
}
