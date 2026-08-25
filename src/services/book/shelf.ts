import { computed, ref, type Ref } from 'vue'
import { createBookComparator, loadPersistedBookSort, persistBookSort } from '@/services/book/sort'
import type {
  BookSortKey,
  BookSortOrder,
  ShelfBook,
  ShelfBooksService,
} from '@/services/book/types'

export type { ShelfBook, ShelfBookFormat, ShelfBooksService } from '@/services/book/types'

// ============================================================
// 模块级单例状态
// 书架数据比组件生命周期存活得更久：切回书架路由时直接复用内存数据，
// 避免“卸载即空态 + 全量重载”。所有成员变更均通过 upsert/remove/set
// 写入本单例，作为书架的唯一真相源。
// ============================================================
const booksByKey: Ref<Map<string, ShelfBook>> = ref(new Map())
const bookOrder = ref<string[]>([])
const persistedSort = loadPersistedBookSort()
const sortKey = ref<BookSortKey>(persistedSort.key)
const sortOrder = ref<BookSortOrder>(persistedSort.order)

// 首载生命周期：idle → loading → ready。失败也落在 ready（空书架），
// 由下次挂载的后台刷新自愈，避免“永久 loading”假死。
const initialLoadState = ref<'idle' | 'loading' | 'ready'>('idle')

// 后台刷新单飞：同一时刻只允许一次全量刷新，防止连点导航触发重叠请求
let refreshInFlight = false

// 就地变更代数：刷新期间若发生 upsert/remove/set，则丢弃过期快照
let mutationEpoch = 0

const bumpMutationEpoch = () => {
  mutationEpoch += 1
}

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

const hasInitiallyLoaded = computed(() => initialLoadState.value === 'ready')
const isInitialLoading = computed(() => !hasInitiallyLoaded.value)

const setShelfBooks = (list: ShelfBook[]) => {
  booksByKey.value = new Map(list.map((book) => [book.bookKey, book]))
  bumpMutationEpoch()
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
  bumpMutationEpoch()
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
  bumpMutationEpoch()
  bookOrder.value = bookOrder.value.filter((orderedBookKey) => orderedBookKey !== bookKey)
}

// ============================================================
// 加载生命周期控制
// ============================================================
const startInitialLoad = (): boolean => {
  if (initialLoadState.value !== 'idle') {
    return false
  }

  initialLoadState.value = 'loading'
  return true
}

const finishInitialLoad = () => {
  initialLoadState.value = 'ready'
}

const startBackgroundRefresh = (): boolean => {
  if (refreshInFlight) {
    return false
  }

  refreshInFlight = true
  return true
}

const finishBackgroundRefresh = () => {
  refreshInFlight = false
}

const getMutationEpoch = () => mutationEpoch

const shelfBooksService: ShelfBooksService = {
  books,
  isBooksEmpty,
  isInitialLoading,
  hasInitiallyLoaded,
  sortKey,
  sortOrder,
  setBookSort,
  setShelfBooks,
  hasShelfBook,
  getShelfBook,
  upsertShelfBook,
  removeShelfBook,
  refreshBookOrder,
  startInitialLoad,
  finishInitialLoad,
  startBackgroundRefresh,
  finishBackgroundRefresh,
  getMutationEpoch,
}

export const useShelfBooksService = (): ShelfBooksService => shelfBooksService
