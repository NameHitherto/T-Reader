import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { BookConfig, BookFormat } from '@/types/book'
import {
  createBookComparator,
  loadPersistedBookSort,
  persistBookSort,
  type BookSortKey,
  type BookSortOrder,
} from '@/services/book/bookSortService'

export type ShelfBookFormat = BookFormat | 'unknown'

export type ShelfBook = BookConfig & {
  bookKey: string
  displayTitle: string
  cover?: string
  format: ShelfBookFormat
  progressValue: number
  lastReadLabel: string
  createdAt: number
}

export interface ShelfBooksService {
  books: ComputedRef<ShelfBook[]>
  isBooksEmpty: ComputedRef<boolean>
  sortKey: Ref<BookSortKey>
  sortOrder: Ref<BookSortOrder>
  setBookSort: (key: BookSortKey, order: BookSortOrder) => void
  setShelfBooks: (list: ShelfBook[]) => void
  hasShelfBook: (bookKey: string) => boolean
  getShelfBook: (bookKey: string) => ShelfBook | undefined
  upsertShelfBook: (book: ShelfBook) => void
  removeShelfBook: (bookKey: string) => void
  refreshBookOrder: () => void
}

export const useShelfBooksService = (): ShelfBooksService => {
  const booksByKey: Ref<Map<string, ShelfBook>> = ref(new Map())
  const bookOrder = ref<string[]>([])
  const persistedSort = loadPersistedBookSort()
  const sortKey = ref<BookSortKey>(persistedSort.key)
  const sortOrder = ref<BookSortOrder>(persistedSort.order)

  const refreshBookOrder = () => {
    const comparator = createBookComparator(sortKey.value, sortOrder.value)
    bookOrder.value = Array.from(booksByKey.value.values())
      .sort(comparator)
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

  const setBookSort = (key: BookSortKey, order: BookSortOrder) => {
    sortKey.value = key
    sortOrder.value = order
    persistBookSort({ key, order })
    refreshBookOrder()
  }

  const removeShelfBook = (bookKey: string) => {
    booksByKey.value.delete(bookKey)
    bookOrder.value = bookOrder.value.filter((orderedBookKey) => orderedBookKey !== bookKey)
  }

  return {
    books,
    isBooksEmpty,
    sortKey,
    sortOrder,
    setBookSort,
    setShelfBooks,
    hasShelfBook,
    getShelfBook,
    upsertShelfBook,
    removeShelfBook,
    refreshBookOrder,
  }
}
