import ePub from 'libs/epub.js'
import { BookConfig } from '@/js/map'
import { BookFormat } from '@/js/bookFormat'
import { BookCachePayload } from '@/services/book/bookCacheService'
import { parseTxtLocation } from '@/services/reader/txtReaderService'

const clampProgress = (value: number): number => {
  if (Number.isNaN(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, value))
}

const isUnreadByFormat = (location: string | undefined, format: BookFormat): boolean => {
  if (format === 'txt') {
    return !location || location === '0'
  }

  return !location
}

export const buildLastReadLabel = (
  bookConfig: Pick<BookConfig, 'updatedAt' | 'location'>,
  progressValue: number
): string => {
  if (progressValue <= 0 || !bookConfig.updatedAt) {
    return '未读'
  }

  const target = new Date(bookConfig.updatedAt)
  if (Number.isNaN(target.getTime())) {
    return '未读'
  }

  const now = new Date()
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  ).getTime()
  const diffDays = Math.floor((startOfNow - startOfTarget) / 86400000)

  if (diffDays <= 0) {
    return '今天'
  }

  if (diffDays === 1) {
    return '昨天'
  }

  if (diffDays < 7) {
    return `${diffDays}天前`
  }

  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(
    target.getDate()
  ).padStart(2, '0')}`
}

export const calculateTxtProgress = (
  location: string | undefined,
  paragraphCount?: number
): number => {
  if (!paragraphCount || paragraphCount <= 1) {
    return 0
  }

  const paragraphIndex = parseTxtLocation(location)
  return clampProgress((paragraphIndex / Math.max(1, paragraphCount - 1)) * 100)
}

export const calculateEpubProgress = async (
  bookData: Uint8Array,
  location: string | undefined,
  cachedLocations?: string
): Promise<number> => {
  if (!location || !cachedLocations) {
    return 0
  }

  const arrayBuffer = bookData.buffer.slice(
    bookData.byteOffset,
    bookData.byteOffset + bookData.byteLength
  ) as ArrayBuffer
  const book = ePub(arrayBuffer)

  try {
    await book.ready
    book.locations.load(cachedLocations)
    return clampProgress(book.locations.percentageFromCfi(location) * 100)
  } catch (error) {
    console.warn('计算 EPUB 阅读进度失败:', error)
    return 0
  } finally {
    try {
      book.destroy?.()
    } catch (error) {
      console.warn('销毁 EPUB 进度实例失败:', error)
    }
  }
}

export const deriveShelfProgress = async (
  bookConfig: Pick<BookConfig, 'location'>,
  format: BookFormat,
  cache: BookCachePayload,
  bookData?: Uint8Array
): Promise<number> => {
  if (isUnreadByFormat(bookConfig.location, format)) {
    return 0
  }

  if (format === 'txt') {
    return calculateTxtProgress(bookConfig.location, cache.paragraphCount)
  }

  if (!bookData) {
    return 0
  }

  return calculateEpubProgress(bookData, bookConfig.location, cache.locations)
}
