import type { ComputedRef, Ref } from 'vue'
import type { BookConfig, BookFormat } from '@/types/book'
import type { UnderlineType } from '@/constants/bookmark'

// ============================================================
// 导入域
// ============================================================
export interface ParsedBookMeta {
  format: BookFormat
  title: string
  author: string
}

export interface ImportBookParams {
  sourcePath: string
  originalFileName: string
  format: BookFormat
  fileBuffer: ArrayBuffer
}

// ============================================================
// 仓库域
// ============================================================
export interface ResolvedBookFile {
  fileName: string
  format: BookFormat
}

export interface LoadedBookBinary extends ResolvedBookFile {
  bookData: Uint8Array
}

export interface StoredBookConfig {
  bookKey: string
  config: BookConfig
  record: StoredBookRecord
}

export interface StoredBookRecord {
  id: string
  title: string
  author: string
  bookKey: string
  fileName: string
  format: BookFormat
  cacheName: string
  hasCover: boolean
  coverName?: string | null
  progress: number
  createdAt: string
  updatedAt: string
}

export interface UpsertBookRequest {
  bookKey?: string
  title: string
  author: string
  fileName: string
  format?: BookFormat
  cacheName?: string
  hasCover?: boolean
  coverName?: string | null
  progress?: number
}

export interface UpdateBookMetadataRequest {
  bookKey: string
  title: string
  author: string
}

export interface UpdateBookMetadataResult {
  oldBookKey: string
  book: StoredBookRecord
}

export interface ImportBookResult {
  bookKey: string
  title: string
  author: string
  fileName: string
  usedCloudConfig: boolean
  createdRecord: StoredBookRecord
}

// ============================================================
// 阅读位置缓存域
// ============================================================
export type BookLocationsCacheStatus = 'ready' | 'building' | 'failed'

export interface BookLocationsCachePayload {
  status: BookLocationsCacheStatus
  locations?: string
}

// ============================================================
// 书架排序域
// ============================================================
export type BookSortKey = 'title' | 'lastRead' | 'createdAt' | 'author'
export type BookSortOrder = 'asc' | 'desc'

export interface BookSortState {
  key: BookSortKey
  order: BookSortOrder
}

export interface BookSortOption {
  key: BookSortKey
  label: string
  defaultOrder: BookSortOrder
}

// ============================================================
// 书架域
// ============================================================
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

// ============================================================
// TXT 目录规则
// ============================================================
export interface TxtTocRule {
  enable: boolean
  example: string
  id: number
  name: string
  rule: string
  serialNumber: number
}

// ============================================================
// 书签
// ============================================================
export interface BookMark {
  // 书签自身主键
  id: string
  // 书签摘录内容
  content: string
  // 所属书籍唯一标识
  bookName: string
  // 所属书籍标题
  bookTitle: string
  // 书签对应的 CFI 定位
  bookCfi: string
  // 创建时间
  createTime: string
  // 用户补充的笔记内容
  comments?: string
  // 下划线颜色
  underlineColor?: string
  // 下划线线型
  underlineType?: UnderlineType
  // 下划线粗细（px）
  underlineWidth?: number
}
