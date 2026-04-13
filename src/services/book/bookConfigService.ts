import { BookConfig, BookProgressSnapshot } from '@/types/book'

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
): BookProgressSnapshot => {
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
    durChapterTitle: typeof raw.durChapterTitle === 'string' ? raw.durChapterTitle : '',
    durChapterTime: normalizeIndex(raw.durChapterTime),
  }
}

export const isUnreadProgressSnapshot = (snapshot: BookProgressSnapshot): boolean => {
  return (
    snapshot.durChapterIndex === 0 &&
    snapshot.durChapterPos === 0 &&
    snapshot.durChapterTitle === ''
  )
}
