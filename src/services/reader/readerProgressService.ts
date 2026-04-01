import { BookFormat } from '@/js/bookFormat'
import { BookMark } from '@/store/bookMark'
import { BookConfig } from '@/js/map'
import { loadBookCache, saveBookCache } from '@/services/book/bookCacheService'
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

export interface SavedReaderProgress {
  bookConfig: BookConfig
  progress: number
}

const clampProgress = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, value))
}

const normalizeIndex = (value: unknown): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.max(0, Math.floor(parsed))
}

const resolveReaderProgressPercent = async (
  args: Pick<SaveReaderProgressArgs, 'bookKey' | 'format' | 'rendition'>,
  bookConfig: Pick<BookConfig, 'durChapterIndex'>,
  txtCurrentParagraph: number
): Promise<number> => {
  const { bookKey, format, rendition } = args

  if (format === 'epub') {
    const currentLocation = await Promise.resolve(rendition?.currentLocation?.())
    const percentage = currentLocation?.start?.percentage
    return typeof percentage === 'number' ? clampProgress(percentage * 100) : 0
  }

  const bookCache = await loadBookCache(bookKey)
  const paragraphCount = bookCache?.paragraphCount
  if (!paragraphCount || paragraphCount <= 1) {
    return 0
  }

  const paragraphIndex = normalizeIndex(
    typeof bookConfig.durChapterIndex === 'number' ? bookConfig.durChapterIndex : txtCurrentParagraph
  )
  return clampProgress((paragraphIndex / Math.max(1, paragraphCount - 1)) * 100)
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
