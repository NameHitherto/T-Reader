import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { BookConfig, BookFormat } from '@/types/book'

export type ShelfBookFormat = BookFormat | 'unknown'

export type ShelfBook = BookConfig & {
  bookKey: string
  displayTitle: string
  cover?: string
  format: ShelfBookFormat
  progressValue: number
  lastReadLabel: string
}

export interface ShelfBooksService {
  books: ComputedRef<ShelfBook[]>
  isBooksEmpty: ComputedRef<boolean>
  setShelfBooks: (list: ShelfBook[]) => void
  hasShelfBook: (bookKey: string) => boolean
  getShelfBook: (bookKey: string) => ShelfBook | undefined
  upsertShelfBook: (book: ShelfBook) => void
  removeShelfBook: (bookKey: string) => void
  refreshBookOrder: () => void
}

const normalizeDurChapterTime = (value: unknown): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

const compareShelfBooks = (left: ShelfBook, right: ShelfBook): number => {
  const timeDiff =
    normalizeDurChapterTime(right.durChapterTime) - normalizeDurChapterTime(left.durChapterTime)
  if (timeDiff !== 0) {
    return timeDiff
  }

  const titleDiff = left.displayTitle.localeCompare(right.displayTitle)
  if (titleDiff !== 0) {
    return titleDiff
  }

  return left.bookKey.localeCompare(right.bookKey)
}

export const useShelfBooksService = (): ShelfBooksService => {
  const booksByKey: Ref<Map<string, ShelfBook>> = ref(new Map())
  const bookOrder = ref<string[]>([])

  const refreshBookOrder = () => {
    bookOrder.value = Array.from(booksByKey.value.values())
      .sort(compareShelfBooks)
      .map((book) => book.bookKey)
  }

  const books = computed(() =>
    bookOrder.value
      .map((bookKey) => booksByKey.value.get(bookKey))
      .filter((book): book is ShelfBook => Boolean(book)),
  )

  const isBooksEmpty = computed(() => books.value.length === 0)

  const setShelfBooks = (list: ShelfBook[]) => {
    booksByKey.value = new Map(list.map((book) => [book.bookKey, book]))
    refreshBookOrder()
  }

  const hasShelfBook = (bookKey: string) => {
    return booksByKey.value.has(bookKey)
  }

  const getShelfBook = (bookKey: string) => {
    return booksByKey.value.get(bookKey)
  }

  const upsertShelfBook = (book: ShelfBook) => {
    booksByKey.value.set(book.bookKey, book)
    refreshBookOrder()
  }

  const removeShelfBook = (bookKey: string) => {
    booksByKey.value.delete(bookKey)
    bookOrder.value = bookOrder.value.filter((orderedBookKey) => orderedBookKey !== bookKey)
  }

  return {
    books,
    isBooksEmpty,
    setShelfBooks,
    hasShelfBook,
    getShelfBook,
    upsertShelfBook,
    removeShelfBook,
    refreshBookOrder,
  }
}
