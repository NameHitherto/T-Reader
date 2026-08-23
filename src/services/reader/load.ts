import type { ReaderLoadResult } from '@/services/reader/types'
import { loadBookBinary, loadBookConfig } from '@/services/book/repository'
import { loadBookLocationsCache } from '@/services/book/locationsCache'

export { ReaderLoadResult }

export const loadReaderBookData = async (bookKey: string): Promise<ReaderLoadResult> => {
  const bookConfig = await loadBookConfig(bookKey)
  const loadedBook = await loadBookBinary(bookKey)
  const bookLocationsCache = await loadBookLocationsCache(bookKey)
  const bookArrayBuffer = loadedBook.bookData.buffer.slice(
    loadedBook.bookData.byteOffset,
    loadedBook.bookData.byteOffset + loadedBook.bookData.byteLength,
  ) as ArrayBuffer

  return {
    bookConfig,
    bookLocationsCache,
    format: loadedBook.format,
    fileName: loadedBook.fileName,
    bookData: loadedBook.bookData,
    bookArrayBuffer,
  }
}
