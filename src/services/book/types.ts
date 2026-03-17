import { BookFormat } from '@/js/bookFormat'

export interface ParsedBookMeta {
  format: BookFormat
  title: string
  author: string
  language: string
  cover: string
}

export interface ImportBookParams {
  id: string
  sourcePath: string
  format: BookFormat
  fileSizeMB: string
  fileBuffer: ArrayBuffer
}
