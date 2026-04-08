import ePub from 'libs/epub.js'
import { ParsedBookMeta } from '@/services/book/types'
import { convertBlobToBase64 } from '@/utils/blob'
import { createDurationLogger, logWarn } from '@/utils/logger'

interface ParseEpubMetaOptions {
  includeCover?: boolean
}

export const parseEpubMeta = async (
  buffer: ArrayBuffer,
  options: ParseEpubMetaOptions = {}
): Promise<ParsedBookMeta> => {
  const finishLog = createDurationLogger('epub-parser', 'parse-epub-meta', {
    includeCover: Boolean(options.includeCover),
    byteLength: buffer.byteLength,
  })
  const book = ePub(buffer)

  try {
    const metadata = await book.loaded.metadata

    let cover = ''
    if (options.includeCover) {
      const coverBlobUrl = await book.coverUrl()
      cover = coverBlobUrl ? await convertBlobToBase64(coverBlobUrl) : ''
    }

    const payload = {
      format: 'epub' as const,
      title: metadata.title || '未知书名',
      author: metadata.creator || '未知作者',
      cover,
    }
    finishLog({
      title: payload.title,
      author: payload.author,
      hasCover: Boolean(payload.cover),
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
