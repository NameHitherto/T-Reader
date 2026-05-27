import { extractEpubLocations, saveEpubCoverResource } from '@/services/book/epub/epubCacheService'
import {
  buildBookCacheCoverAssetUrl,
  buildBookCacheDir,
} from '@/services/book/bookCachePathService'
import { saveBookLocationsCache } from '@/services/book/bookLocationsCacheService'
import { createDurationLogger, logWarn } from '@/utils/logger'
import { removeLocalDir } from '@/services/fileSystem/localStorageService'

export interface BookResourcePayload {
  coverResource?: string | null
  coverUrl?: string
}

export const buildBookCoverUrl = async (
  bookKey: string,
  coverResource?: string | null,
): Promise<string | undefined> => {
  if (!coverResource) {
    return undefined
  }

  return await buildBookCacheCoverAssetUrl(bookKey, coverResource)
}

export const removeBookCacheDir = async (bookKey: string): Promise<void> => {
  await removeLocalDir(await buildBookCacheDir(bookKey))
}

export const primeBookResourcesAfterImport = async (
  bookKey: string,
  fileBuffer: ArrayBuffer,
  originalFileName: string,
): Promise<BookResourcePayload> => {
  const finishLog = createDurationLogger(
    'book-cache-service',
    'prime-book-resources-after-import',
    {
      fileName: originalFileName,
    },
  )
  const coverResource = await saveEpubCoverResource(bookKey, fileBuffer)
  const locationsStatus = 'building' as const
  await saveBookLocationsCache(bookKey, {
    status: locationsStatus,
  })

  // 在后台异步生成 locations，避免阻塞导入流程
  void (async () => {
    try {
      const locations = await extractEpubLocations(fileBuffer)
      await saveBookLocationsCache(bookKey, {
        status: 'ready',
        locations,
      })
    } catch (error) {
      logWarn('book-cache-service', 'prime-epub-locations-cache failed', {
        fileName: originalFileName,
        error,
      })
      try {
        await saveBookLocationsCache(bookKey, {
          status: 'failed',
        })
      } catch (saveError) {
        logWarn('book-cache-service', 'mark-epub-locations-cache failed-status failed', {
          fileName: originalFileName,
          error: saveError,
        })
      }
    }
  })()

  finishLog({
    fileName: originalFileName,
    hasCover: Boolean(coverResource),
    locationsStatus,
  })
  return {
    coverResource,
    coverUrl: await buildBookCoverUrl(bookKey, coverResource),
  }
}
