import { BookConfig, BookFormat, BookProgressSnapshot } from '@/types/book'
import { BookCachePayload } from '@/services/book/bookCacheService'
import {
  buildTxtProgressSnapshot,
  isUnreadProgressSnapshot,
} from '@/services/book/bookConfigService'
import {
  calculateEpubProgressFromSnapshot,
  resolveEpubDisplayTarget,
  serializeEpubProgress,
} from '@/services/reader/epubProgressService'

interface SerializeReaderProgressArgs {
  format: BookFormat
  rendition: any
  txtCurrentParagraph: number
}

const normalizeIndex = (value: unknown): number => {
  const parsed = Number(value)
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return 0
  }
  return Math.max(0, Math.floor(parsed))
}

export const serializeReaderProgress = async (
  args: SerializeReaderProgressArgs
): Promise<BookProgressSnapshot | null> => {
  const { format, rendition, txtCurrentParagraph } = args

  if (format === 'epub') {
    return serializeEpubProgress(rendition)
  }

  return buildTxtProgressSnapshot(txtCurrentParagraph)
}

export const resolveReaderDisplayTarget = async (
  format: BookFormat,
  source: any,
  snapshot: BookProgressSnapshot
): Promise<string | number | undefined> => {
  if (format === 'epub') {
    return resolveEpubDisplayTarget(source, snapshot)
  }

  return normalizeIndex(snapshot.durChapterIndex)
}

export const calculateShelfProgress = async (
  format: BookFormat,
  bookData: Uint8Array | undefined,
  snapshot: BookProgressSnapshot,
  cache: BookCachePayload
): Promise<number> => {
  if (isUnreadProgressSnapshot(snapshot)) {
    return 0
  }

  if (format === 'epub') {
    if (!bookData) {
      return 0
    }
    return calculateEpubProgressFromSnapshot(bookData, snapshot, cache.locations)
  }

  if (!cache.paragraphCount || cache.paragraphCount <= 1) {
    return 0
  }

  return (normalizeIndex(snapshot.durChapterIndex) / Math.max(1, cache.paragraphCount - 1)) * 100
}

export const isNormalizedProgressSnapshot = (
  value: Partial<BookConfig>
): value is BookProgressSnapshot => {
  return (
    typeof value.durChapterIndex === 'number' &&
    typeof value.durChapterPos === 'number' &&
    typeof value.durChapterTitle === 'string' &&
    typeof value.durChapterTime === 'number'
  )
}
