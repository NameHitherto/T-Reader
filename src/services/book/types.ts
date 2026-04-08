import { BookFormat } from '@/types/book'

export interface ParsedBookMeta {
  format: BookFormat
  title: string
  author: string
  cover: string
}

export interface ImportBookParams {
  sourcePath: string
  originalFileName: string
  format: BookFormat
  fileBuffer: ArrayBuffer
}
