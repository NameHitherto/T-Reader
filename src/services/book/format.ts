import type { BookFormat } from '@/types/book'

const SUPPORTED_FORMATS: BookFormat[] = ['epub']

export const detectBookFormatFromPath = (path: string): BookFormat | null => {
  const ext = path.split('.').pop()?.toLowerCase()
  if (!ext) {
    return null
  }

  if (SUPPORTED_FORMATS.includes(ext as BookFormat)) {
    return ext as BookFormat
  }

  return null
}
