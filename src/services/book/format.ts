import { SUPPORTED_BOOK_FORMATS } from '@/constants'
import type { BookFormat } from '@/services/book/types'
import { getExt } from '@/utils/path'

export const detectBookFormatFromPath = (path: string): BookFormat | null => {
  const ext = getExt(path).toLowerCase()
  if (!ext) {
    return null
  }

  if ((SUPPORTED_BOOK_FORMATS as readonly string[]).includes(ext)) {
    return ext as BookFormat
  }

  return null
}
