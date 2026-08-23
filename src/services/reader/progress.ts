import { BookMark } from '@/store/bookMark'
import { BookConfig, BookProgressSnapshot } from '@/types/book'
import { loadBookConfig, saveBookConfig, updateBookProgress } from '@/services/book/bookRepository'
import { replaceBookMarksForBook } from '@/services/book/bookMarksRepository'
import { isUnreadProgressSnapshot } from '@/services/book/bookConfigService'
import {
  calculateEpubProgress,
  calculateEpubProgressFromSnapshot,
  resolveEpubDisplayTarget,
  serializeEpubProgress,
} from '@/services/reader/epubProgress'
import type { EpubBookLike, EpubRenditionLike } from '@/types/epub'

import type { BookLocationsCachePayload } from '@/services/book/bookLocationsCacheService'

interface SaveReaderProgressArgs {
  bookKey: string
  rendition: EpubRenditionLike | null
  bookMarks: BookMark[]
  currentBookConfig?: BookConfig | null
}

export interface SavedReaderProgress {
  bookConfig: BookConfig
  progress: number
}

export const serializeReaderProgress = async (
  rendition: EpubRenditionLike | null,
): Promise<BookProgressSnapshot | null> => {
  return await serializeEpubProgress(rendition)
}

export const resolveReaderDisplayTarget = async (
  source: EpubBookLike,
  snapshot: BookProgressSnapshot,
): Promise<string | number | undefined> => {
  return await resolveEpubDisplayTarget(source, snapshot)
}

export const calculateShelfProgress = async (
  bookData: Uint8Array | undefined,
  snapshot: BookProgressSnapshot,
  locationsCache?: BookLocationsCachePayload | null,
): Promise<number> => {
  if (isUnreadProgressSnapshot(snapshot)) {
    return 0
  }

  if (!bookData) {
    return 0
  }

  const cachedLocations = locationsCache?.status === 'ready' ? locationsCache.locations : undefined

  return await calculateEpubProgressFromSnapshot(bookData, snapshot, cachedLocations)
}

const resolveReaderProgressPercent = async (
  rendition: EpubRenditionLike | null,
): Promise<number> => {
  return await calculateEpubProgress(rendition)
}

export const saveReaderProgress = async (
  args: SaveReaderProgressArgs,
): Promise<SavedReaderProgress | null> => {
  const { bookKey, rendition, bookMarks, currentBookConfig } = args

  const bookConfig = currentBookConfig ? { ...currentBookConfig } : await loadBookConfig(bookKey)
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
  const progress = await resolveReaderProgressPercent(rendition)
  await updateBookProgress(bookKey, progress)

  return {
    bookConfig,
    progress,
  }
}
