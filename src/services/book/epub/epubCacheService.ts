import ePub from 'libs/epub.js'
import { parseEpubMeta } from '@/services/book/epub/epubParser'
import { BookCachePrimeHandler } from '@/services/book/types'
import { createDurationLogger, logWarn } from '@/utils/logger'

export const extractEpubLocations = async (
  fileBuffer: ArrayBuffer
): Promise<string> => {
  const finishLog = createDurationLogger('book-cache-service', 'extract-epub-locations')
  const book = ePub(fileBuffer)

  try {
    await book.ready
    await book.locations.generate(1000)
    const locations = book.locations.save()
    finishLog({
      locationLength: locations.length,
    })
    return locations
  } finally {
    try {
      book.destroy?.()
    } catch (error) {
      logWarn('book-cache-service', 'release-epub-locations-instance failed', {
        error,
      })
    }
  }
}

export const epubBookCacheHandler: BookCachePrimeHandler = {
  hasRequiredCache(cache) {
    return Boolean(cache.title && cache.cover !== undefined)
  },
  async buildCachePayload({ fileBuffer, originalFileName, currentCache }) {
    const progress = currentCache.progress ?? 0

    try {
      const meta = await parseEpubMeta(fileBuffer, { includeCover: true })

      return {
        title: meta.title,
        cover: meta.cover || '',
        progress,
      }
    } catch (error) {
      logWarn('book-cache-service', 'prime-book-cache-after-import fallback', {
        fileName: originalFileName,
        format: 'epub',
        error,
      })

      return {
        progress,
      }
    }
  },
}
