import type { ShelfBook } from '@/services/book/types'
import type { BookSortKey, BookSortOrder, BookSortState, BookSortOption } from '@/services/book/types'

export type { BookSortKey, BookSortOrder, BookSortState, BookSortOption } from '@/services/book/types'

// 面板展示顺序（2×2）：标题 / 最近阅读 / 添加日期 / 作者
export const BOOK_SORT_OPTIONS: readonly BookSortOption[] = [
  { key: 'title', label: '标题', defaultOrder: 'asc' },
  { key: 'lastRead', label: '最近阅读', defaultOrder: 'desc' },
  { key: 'createdAt', label: '添加日期', defaultOrder: 'desc' },
  { key: 'author', label: '作者', defaultOrder: 'asc' },
] as const

export const DEFAULT_BOOK_SORT_STATE: BookSortState = {
  key: 'lastRead',
  order: 'desc',
}

const BOOK_SORT_STORAGE_KEY = 'bookshelfSort'

// ============================================================
// 归一化
// ============================================================
const isBookSortKey = (value: unknown): value is BookSortKey => {
  return value === 'title' || value === 'lastRead' || value === 'createdAt' || value === 'author'
}

const isBookSortOrder = (value: unknown): value is BookSortOrder => {
  return value === 'asc' || value === 'desc'
}

export const normalizeBookSortState = (value: unknown): BookSortState => {
  if (value && typeof value === 'object') {
    const candidate = value as Partial<BookSortState>
    if (isBookSortKey(candidate.key) && isBookSortOrder(candidate.order)) {
      return {
        key: candidate.key,
        order: candidate.order,
      }
    }
  }

  return { ...DEFAULT_BOOK_SORT_STATE }
}

const toComparableTime = (value: unknown): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * 将数据库返回的添加时间字符串解析为时间戳。
 * SQLite datetime('now') 产出 "YYYY-MM-DD HH:MM:SS"（UTC），需补 'T' 与 'Z'
 * 才能被 Date.parse 稳定识别；同时兼容 ISO 8601（含 'T'）格式。
 */
export const parseBookCreatedAt = (value: string | null | undefined): number => {
  if (!value) {
    return 0
  }

  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const timestamp = Date.parse(normalized)

  return Number.isFinite(timestamp) ? timestamp : 0
}

// ============================================================
// 持久化
// ============================================================
export const loadPersistedBookSort = (): BookSortState => {
  try {
    const raw = localStorage.getItem(BOOK_SORT_STORAGE_KEY)
    if (!raw) {
      return { ...DEFAULT_BOOK_SORT_STATE }
    }

    return normalizeBookSortState(JSON.parse(raw) as unknown)
  } catch {
    return { ...DEFAULT_BOOK_SORT_STATE }
  }
}

export const persistBookSort = (state: BookSortState): void => {
  try {
    localStorage.setItem(BOOK_SORT_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage 不可用（隐私模式等）时静默降级，不影响排序功能
  }
}

// ============================================================
// 比较器工厂
// ============================================================
export const createBookComparator = (
  key: BookSortKey,
  order: BookSortOrder,
): ((left: ShelfBook, right: ShelfBook) => number) => {
  const normalizedKey = isBookSortKey(key) ? key : DEFAULT_BOOK_SORT_STATE.key
  const normalizedOrder = isBookSortOrder(order) ? order : DEFAULT_BOOK_SORT_STATE.order
  const direction = normalizedOrder === 'desc' ? -1 : 1

  // 统一返回「自然升序」差值（left 在前为负），方向由 direction 翻转
  const resolvePrimaryDiff = (left: ShelfBook, right: ShelfBook): number => {
    switch (normalizedKey) {
      case 'lastRead':
        return toComparableTime(left.durChapterTime) - toComparableTime(right.durChapterTime)
      case 'createdAt':
        return toComparableTime(left.createdAt) - toComparableTime(right.createdAt)
      case 'author':
        return (left.author || '').localeCompare(right.author || '')
      case 'title':
        return left.displayTitle.localeCompare(right.displayTitle)
      default:
        // 归一化后不可达；回退默认关键字（最近阅读）保证防御性行为可预期
        return toComparableTime(left.durChapterTime) - toComparableTime(right.durChapterTime)
    }
  }

  return (left: ShelfBook, right: ShelfBook): number => {
    const primaryDiff = resolvePrimaryDiff(left, right)

    if (primaryDiff !== 0) {
      return primaryDiff * direction
    }

    // 主排序相等时降级为标题 → bookKey，保证顺序稳定且可预期
    const titleDiff = left.displayTitle.localeCompare(right.displayTitle)
    if (titleDiff !== 0) {
      return titleDiff
    }

    return left.bookKey.localeCompare(right.bookKey)
  }
}
