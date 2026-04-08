import { BookMark } from '@/store/bookMark'
import { BookConfig, BookFormat } from '@/types/book'
import { loadBookCache, saveBookCache } from '@/services/book/bookCacheService'
import { loadBookConfig, saveBookConfig } from '@/services/book/bookRepository'
import { replaceBookMarksForBook } from '@/services/book/bookMarksRepository'
import {
  getReaderProgressHandler,
  serializeReaderProgress,
} from '@/services/reader/progressSnapshotService'

interface SaveReaderProgressArgs {
  bookKey: string
  format: BookFormat
  rendition: any
  txtCurrentParagraph: number
  bookMarks: BookMark[]
}

export interface SavedReaderProgress {
  bookConfig: BookConfig
  progress: number
}

const resolveReaderProgressPercent = async (
  args: Pick<SaveReaderProgressArgs, 'bookKey' | 'format' | 'rendition'>,
  bookConfig: Pick<BookConfig, 'durChapterIndex'>,
  txtCurrentParagraph: number
): Promise<number> => {
  const { bookKey, format, rendition } = args
  const bookCache = await loadBookCache(bookKey)
  return await getReaderProgressHandler(format).calculateProgress({
    rendition,
    bookConfig,
    txtCurrentParagraph,
    bookCache,
  })
}

export const saveReaderProgress = async (
  args: SaveReaderProgressArgs
): Promise<SavedReaderProgress | null> => {
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
  const progress = await resolveReaderProgressPercent(
    {
      bookKey,
      format,
      rendition,
    },
    bookConfig,
    txtCurrentParagraph
  )
  await saveBookCache(bookKey, {
    progress,
  })

  return {
    bookConfig,
    progress,
  }
}
