import { BookConfig } from '@/types/book'
import { ReaderProgressHandler } from '@/services/reader/formatTypes'
import { buildTxtProgressSnapshot } from '@/services/book/bookConfigService'

const normalizeIndex = (value: unknown): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.max(0, Math.floor(parsed))
}

const clampProgress = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, value))
}

export const txtReaderProgressHandler: ReaderProgressHandler = {
  async serializeProgress({ txtCurrentParagraph }) {
    return buildTxtProgressSnapshot(txtCurrentParagraph)
  },
  async resolveDisplayTarget(_source, snapshot) {
    return normalizeIndex(snapshot.durChapterIndex)
  },
  async calculateProgress({ bookConfig, txtCurrentParagraph, bookCache }) {
    const paragraphCount = bookCache?.paragraphCount
    if (!paragraphCount || paragraphCount <= 1) {
      return 0
    }

    const paragraphIndex = normalizeIndex(
      typeof bookConfig.durChapterIndex === 'number'
        ? bookConfig.durChapterIndex
        : txtCurrentParagraph
    )

    return clampProgress((paragraphIndex / Math.max(1, paragraphCount - 1)) * 100)
  },
  async calculateShelfProgress({ snapshot, cache }) {
    if (!cache.paragraphCount || cache.paragraphCount <= 1) {
      return 0
    }

    return (
      (normalizeIndex(snapshot.durChapterIndex) / Math.max(1, cache.paragraphCount - 1)) * 100
    )
  },
}

export const isTxtProgressSnapshot = (value: Partial<BookConfig>): boolean => {
  return typeof value.durChapterIndex === 'number'
}
