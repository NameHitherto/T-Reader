import ePub from 'libs/epub.js'
import { ParsedBookMeta } from '@/services/book/types'
import { logInfo, logWarn } from '@/utils/logger'

export const parseEpubMeta = async (buffer: ArrayBuffer): Promise<ParsedBookMeta> => {
  const book = ePub(buffer)

  try {
    const metadata = await book.loaded.metadata

    const payload = {
      format: 'epub' as const,
      title: metadata.title || '',
      author: metadata.creator || '',
    }
    logInfo('epub-parser', 'parse-epub-meta', {
      byteLength: buffer.byteLength,
      title: payload.title,
      author: payload.author,
    })
    return payload
  } finally {
    try {
      book.destroy?.()
    } catch (error) {
      logWarn('epub-parser', 'destroy-epub-instance failed', {
        error,
      })
    }
  }
}
