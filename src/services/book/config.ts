import { BookConfig, BookProgressSnapshot } from '@/services/book/types'

const normalizeIndex = (value: unknown): number => {
  const parsed = Number(value)
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return 0
  }
  return Math.max(0, Math.floor(parsed))
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
