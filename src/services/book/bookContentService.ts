import { loadBookBinary } from '@/services/book/bookRepository'
import { extractEpubContent } from '@/services/book/epub/epubContentService'

export const extractBookContent = async (bookKey: string): Promise<string> => {
  const loadedBook = await loadBookBinary(bookKey)

  if (loadedBook.format === 'txt') {
    return new TextDecoder().decode(loadedBook.bookData).slice(0, 10000)
  }

  return await extractEpubContent(loadedBook.bookData)
}
