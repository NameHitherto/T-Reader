import { ensureBookCache, loadBookBinary, loadBookConfig } from '@/services/book/bookRepository'
import { loadBookLocationsCache } from '@/services/book/bookLocationsCacheService'
import { ReaderFormatLoadResult } from '@/services/reader/formatTypes'

export type ReaderLoadResult = ReaderFormatLoadResult

export const loadReaderBookData = async (bookKey: string): Promise<ReaderFormatLoadResult> => {
  const bookConfig = await loadBookConfig(bookKey)
  const [bookCache, loadedBook] = await Promise.all([
    ensureBookCache(bookKey),
    loadBookBinary(bookKey),
  ])
  const bookLocationsCache = await loadBookLocationsCache(bookKey)
  const bookArrayBuffer = loadedBook.bookData.buffer.slice(
    loadedBook.bookData.byteOffset,
    loadedBook.bookData.byteOffset + loadedBook.bookData.byteLength,
  ) as ArrayBuffer

  return {
    bookConfig,
    bookCache,
    bookLocationsCache,
    format: loadedBook.format,
    fileName: loadedBook.fileName,
    bookData: loadedBook.bookData,
    bookArrayBuffer,
  }
}
