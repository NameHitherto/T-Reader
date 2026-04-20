import { BookConfig } from '@/types/book'
import {
  isUnreadProgressSnapshot,
  normalizeBookConfig,
} from '@/services/book/bookConfigService'

export const normalizeDisplayedChapterTitle = (
  title?: string | null,
  fallback = '暂无章节标题'
) => {
  const normalizedTitle = typeof title === 'string' ? title.trim() : ''

  if (!normalizedTitle) {
    return fallback
  }

  return normalizedTitle
}

export const buildLastReadLabel = (
  bookConfig: Pick<BookConfig, 'durChapterIndex' | 'durChapterPos' | 'durChapterTitle' | 'durChapterTime'>,
  progressValue: number
): string => {
  const snapshot = normalizeBookConfig({
    name: '',
    author: '',
    ...bookConfig,
  })
  const rawTimestamp = snapshot.durChapterTime

  if (
    progressValue <= 0 ||
    typeof rawTimestamp !== 'number' ||
    Number.isNaN(rawTimestamp) ||
    isUnreadProgressSnapshot(snapshot)
  ) {
    return '未读'
  }

  const target = new Date(rawTimestamp)
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
