import { BookConfig } from '@/js/map'
import { BookFormat } from '@/js/bookFormat'
import { loadBookBinary, loadBookConfig } from '@/services/book/bookRepository'

export interface ReaderLoadResult {
  bookConfig: BookConfig
  format: BookFormat
  bookData: Uint8Array
  bookArrayBuffer: ArrayBuffer
}

export const loadReaderBookData = async (bookId: string): Promise<ReaderLoadResult> => {
  const bookConfig = await loadBookConfig(bookId)
  const format = (bookConfig.format || 'epub') as BookFormat
  const bookData = await loadBookBinary(bookId, format)

  return {
    bookConfig,
    format,
    bookData,
    bookArrayBuffer: bookData.buffer as ArrayBuffer,
  }
}
