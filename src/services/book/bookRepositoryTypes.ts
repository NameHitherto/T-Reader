import type { BookFormat } from '@/types/book'

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
