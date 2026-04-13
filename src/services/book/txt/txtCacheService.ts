import { parseTxtMeta } from '@/services/book/txt/txtParser'
import { BookCachePrimeHandler } from '@/services/book/types'
import { createDurationLogger } from '@/utils/logger'
import { splitTextToParagraphs } from '@/utils/txtText'

const extractTxtParagraphCount = (fileBuffer: ArrayBuffer): number => {
  const finishLog = createDurationLogger('book-cache-service', 'extract-txt-paragraph-count')
  const textContent = new TextDecoder().decode(fileBuffer)
  const paragraphCount = splitTextToParagraphs(textContent).length
  finishLog({
    paragraphCount,
    textLength: textContent.length,
  })
  return paragraphCount
}

export const txtBookCacheHandler: BookCachePrimeHandler = {
  hasRequiredCache(cache) {
    return Boolean(cache.paragraphCount && cache.title)
  },
  async buildCachePayload({ fileBuffer, originalFileName, currentCache }) {
    return {
      title: parseTxtMeta(originalFileName).title,
      paragraphCount: extractTxtParagraphCount(fileBuffer),
      progress: currentCache.progress ?? 0,
    }
  },
}
