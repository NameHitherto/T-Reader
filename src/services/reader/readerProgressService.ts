import { BookFormat } from '@/js/bookFormat'
import { BookMark } from '@/store/bookMark'
import { BookConfig } from '@/js/map'
import { loadBookConfig, saveBookConfig } from '@/services/book/bookRepository'
import { replaceBookMarksForBook } from '@/services/book/bookMarksRepository'
import { serializeReaderProgress } from '@/services/reader/progressSnapshotService'

interface SaveReaderProgressArgs {
  bookKey: string
  format: BookFormat
  rendition: any
  txtCurrentParagraph: number
  bookMarks: BookMark[]
}

export const saveReaderProgress = async (
  args: SaveReaderProgressArgs
): Promise<BookConfig | null> => {
  const { bookKey, format, rendition, txtCurrentParagraph, bookMarks } = args

  const bookConfig = await loadBookConfig(bookKey)
  const progressSnapshot = await serializeReaderProgress({
    format,
    rendition,
    txtCurrentParagraph,
  })
  if (!progressSnapshot) {
    return null
  }

  bookConfig.durChapterIndex = progressSnapshot.durChapterIndex
  bookConfig.durChapterPos = progressSnapshot.durChapterPos
  bookConfig.durChapterTitle = progressSnapshot.durChapterTitle
  bookConfig.durChapterTime = progressSnapshot.durChapterTime

  if (format === 'epub') {
    const nextBookMarks = bookMarks.filter((mark) => mark.bookName === bookKey)
    await replaceBookMarksForBook(bookKey, nextBookMarks)
  }

  await saveBookConfig(bookKey, bookConfig)
  return bookConfig
}
