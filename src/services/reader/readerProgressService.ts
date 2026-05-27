import { BookMark } from '@/store/bookMark'
import { BookConfig } from '@/types/book'
import { loadBookConfig, saveBookConfig, updateBookProgress } from '@/services/book/bookRepository'
import { replaceBookMarksForBook } from '@/services/book/bookMarksRepository'
import { serializeReaderProgress } from '@/services/reader/progressSnapshotService'
import { epubReaderProgressHandler } from '@/services/reader/epub/epubProgressService'
import type { EpubRenditionLike } from '@/types/epub'

interface SaveReaderProgressArgs {
  bookKey: string
  rendition: EpubRenditionLike | null
  bookMarks: BookMark[]
}

export interface SavedReaderProgress {
  bookConfig: BookConfig
  progress: number
}

const resolveReaderProgressPercent = async (
  rendition: EpubRenditionLike | null,
  bookConfig: Pick<BookConfig, 'durChapterIndex'>,
): Promise<number> => {
  return await epubReaderProgressHandler.calculateProgress({
    rendition,
    bookConfig,
  })
}

export const saveReaderProgress = async (
  args: SaveReaderProgressArgs,
): Promise<SavedReaderProgress | null> => {
  const { bookKey, rendition, bookMarks } = args

  const bookConfig = await loadBookConfig(bookKey)
  const progressSnapshot = await serializeReaderProgress(rendition)
  if (!progressSnapshot) {
    return null
  }

  bookConfig.durChapterIndex = progressSnapshot.durChapterIndex
  bookConfig.durChapterPos = progressSnapshot.durChapterPos
  bookConfig.durChapterTitle = progressSnapshot.durChapterTitle
  bookConfig.durChapterTime = progressSnapshot.durChapterTime

  const nextBookMarks = bookMarks.filter((mark) => mark.bookName === bookKey)
  await replaceBookMarksForBook(bookKey, nextBookMarks)

  await saveBookConfig(bookKey, bookConfig)
  const progress = await resolveReaderProgressPercent(rendition, bookConfig)
  await updateBookProgress(bookKey, progress)

  return {
    bookConfig,
    progress,
  }
}
