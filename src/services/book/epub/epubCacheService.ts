import ePub from 'libs/epub.js'
import { parseEpubMeta } from '@/services/book/epub/epubParser'
import { BookCachePrimeHandler } from '@/services/book/types'
import { buildBookCacheCoverPath, buildBookCacheDir } from '@/services/book/bookCachePathService'
import { ensureLocalDir, writeBinaryFile } from '@/services/fileSystem/localStorageService'
import { createDurationLogger, logWarn } from '@/utils/logger'

export const extractEpubLocations = async (fileBuffer: ArrayBuffer): Promise<string> => {
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

const COVER_MIME_EXTENSIONS: Record<string, string> = {
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/gif': 'gif',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
}

const toCoverResourceFilename = (mimeType: string): string => {
  const extension = COVER_MIME_EXTENSIONS[mimeType.toLowerCase()] || 'bin'

  return `cover.${extension}`
}

const extractEpubCoverBlob = async (fileBuffer: ArrayBuffer): Promise<Blob | null> => {
  const book = ePub(fileBuffer)

  try {
    const coverBlobUrl = await book.coverUrl()
    if (!coverBlobUrl) {
      return null
    }

    const response = await fetch(coverBlobUrl)

    return await response.blob()
  } finally {
    try {
      book.destroy?.()
    } catch (error) {
      logWarn('book-cache-service', 'release-epub-cover-instance failed', {
        error,
      })
    }
  }
}

const saveEpubCoverResource = async (
  bookKey: string,
  fileBuffer: ArrayBuffer,
): Promise<string | null> => {
  try {
    const coverBlob = await extractEpubCoverBlob(fileBuffer)
    if (!coverBlob) {
      return null
    }

    const coverResource = toCoverResourceFilename(coverBlob.type)
    await ensureLocalDir(await buildBookCacheDir(bookKey))
    await writeBinaryFile(
      await buildBookCacheCoverPath(bookKey, coverResource),
      new Uint8Array(await coverBlob.arrayBuffer()),
    )

    return coverResource
  } catch (error) {
    logWarn('book-cache-service', 'save-epub-cover-resource failed', {
      bookKey,
      error,
    })
    return null
  }
}

export const epubBookCacheHandler: BookCachePrimeHandler = {
  hasRequiredCache(cache) {
    return Boolean(cache.title && cache.coverResource !== undefined)
  },
  async buildCachePayload({ bookKey, fileBuffer, originalFileName, currentCache }) {
    const progress = currentCache.progress ?? 0

    try {
      const meta = await parseEpubMeta(fileBuffer)
      const coverResource = await saveEpubCoverResource(bookKey, fileBuffer)

      return {
        title: meta.title,
        coverResource,
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
