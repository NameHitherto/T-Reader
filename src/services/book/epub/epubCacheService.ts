import ePub from 'libs/epub.js'
import { buildBookCacheCoverPath, buildBookCacheDir } from '@/services/book/bookCachePathService'
import { ensureLocalDir, writeBinaryFile } from '@/services/fileSystem/localStorageService'
import { logInfo, logWarn } from '@/utils/logger'

export const extractEpubLocations = async (fileBuffer: ArrayBuffer): Promise<string> => {
  const book = ePub(fileBuffer)

  try {
    await book.ready
    await book.locations.generate(1000)
    const locations = book.locations.save()
    logInfo('book-cache', 'extract-epub-locations', {
      locationLength: locations.length,
    })
    return locations
  } finally {
    try {
      book.destroy?.()
    } catch (error) {
      logWarn('book-cache', 'release-epub-locations-instance failed', {
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
      logWarn('book-cache', 'release-epub-cover-instance failed', {
        error,
      })
    }
  }
}

export const saveEpubCoverResource = async (
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
    logWarn('book-cache', 'save-epub-cover-resource failed', {
      bookKey,
      error,
    })
    return null
  }
}
