import { BookFormat } from '@/js/bookFormat'

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
