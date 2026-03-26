import { BookConfig } from '@/js/map'
import { BookFormat } from '@/js/bookFormat'
import { BookCachePayload } from '@/services/book/bookCacheService'
import {
  calculateEpubProgressFromSnapshot,
  resolveEpubDisplayTarget,
  serializeEpubProgress,
} from '@/services/reader/epubProgressService'

export interface ProgressSnapshot {
  durChapterIndex: number
  durChapterPos: number
  durChapterTitle: string
  durChapterTime: number
}

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

export const buildTxtProgressSnapshot = (
  paragraphIndex: number,
  timestamp = Date.now()
): ProgressSnapshot => {
  const safeIndex = normalizeIndex(paragraphIndex)
  return {
    durChapterIndex: safeIndex,
    durChapterPos: 0,
    durChapterTitle: `paragraph-${safeIndex}`,
    durChapterTime: timestamp,
  }
}

export const normalizeBookConfig = (raw: Partial<BookConfig>): BookConfig => {
  return {
    name: String(raw.name || ''),
    author: String(raw.author || ''),
    durChapterIndex: normalizeIndex(raw.durChapterIndex),
    durChapterPos: normalizeIndex(raw.durChapterPos),
    durChapterTitle:
      typeof raw.durChapterTitle === 'string' ? raw.durChapterTitle : '',
    durChapterTime: normalizeIndex(raw.durChapterTime),
  }
}

export const isUnreadProgressSnapshot = (snapshot: ProgressSnapshot): boolean => {
  return (
    snapshot.durChapterIndex === 0 &&
    snapshot.durChapterPos === 0 &&
    snapshot.durChapterTitle === ''
  )
}

export const serializeReaderProgress = async (
  args: SerializeReaderProgressArgs
): Promise<ProgressSnapshot | null> => {
  const { format, rendition, txtCurrentParagraph } = args

  if (format === 'epub') {
    return serializeEpubProgress(rendition)
  }

  return buildTxtProgressSnapshot(txtCurrentParagraph)
}

export const resolveReaderDisplayTarget = async (
  format: BookFormat,
  source: any,
  snapshot: ProgressSnapshot
): Promise<string | number | undefined> => {
  if (format === 'epub') {
    return resolveEpubDisplayTarget(source, snapshot)
  }

  return normalizeIndex(snapshot.durChapterIndex)
}

export const calculateShelfProgress = async (
  format: BookFormat,
  bookData: Uint8Array | undefined,
  snapshot: ProgressSnapshot,
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
): value is ProgressSnapshot => {
  return (
    typeof value.durChapterIndex === 'number' &&
    typeof value.durChapterPos === 'number' &&
    typeof value.durChapterTitle === 'string' &&
    typeof value.durChapterTime === 'number'
  )
}
