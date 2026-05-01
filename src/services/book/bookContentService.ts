import { loadBookBinary } from '@/services/book/bookRepository'
import { extractEpubContent } from '@/services/book/epub/epubContentService'

export const extractBookContent = async (bookKey: string): Promise<string> => {
  const loadedBook = await loadBookBinary(bookKey)

  return await extractEpubContent(loadedBook.bookData)
}
