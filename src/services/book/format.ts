import type { BookFormat } from '@/services/book/types'
import { getExt } from '@/utils/path'

const SUPPORTED_FORMATS: BookFormat[] = ['epub']

export const detectBookFormatFromPath = (path: string): BookFormat | null => {
  const ext = getExt(path).toLowerCase()
  if (!ext) {
    return null
  }

  if (SUPPORTED_FORMATS.includes(ext as BookFormat)) {
    return ext as BookFormat
  }

  return null
}
