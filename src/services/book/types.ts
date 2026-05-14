import type { BookConfig, BookFormat } from '@/types/book'
import type { BookCachePayload } from '@/services/book/bookCacheService'

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

export interface BookImportHandler {
  parseMeta: (params: ImportBookParams) => Promise<ParsedBookMeta>
  buildInitialBookConfig: (meta: ParsedBookMeta) => BookConfig
}

export interface BookCachePrimeHandler {
  hasRequiredCache: (cache: BookCachePayload) => boolean
  buildCachePayload: (args: {
    bookKey: string
    fileBuffer: ArrayBuffer
    originalFileName: string
    currentCache: BookCachePayload
  }) => Promise<BookCachePayload>
}
