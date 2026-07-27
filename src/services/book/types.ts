import type { BookConfig, BookFormat } from '@/types/book'

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
