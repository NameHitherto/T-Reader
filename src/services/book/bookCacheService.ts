import {
  epubBookCacheHandler,
  extractEpubLocations,
} from '@/services/book/epub/epubCacheService'
import { toBookCacheFilename } from '@/services/book/bookIdentity'
import {
  saveBookLocationsCache,
} from '@/services/book/bookLocationsCacheService'
import { createDurationLogger, logWarn } from '@/utils/logger'
import {
  buildLocalFilePath,
  LOCAL_DIRS,
  readJsonFile,
  writeJsonFile,
} from '@/services/fileSystem/localStorageService'

export interface BookCachePayload {
  title?: string
  cover?: string
  progress?: number
}

const normalizeBookCachePayload = (payload: Partial<BookCachePayload> & Record<string, unknown>): BookCachePayload => {
  return {
    title: typeof payload.title === 'string' ? payload.title : undefined,
    cover: typeof payload.cover === 'string' ? payload.cover : undefined,
    progress:
      typeof payload.progress === 'number' && Number.isFinite(payload.progress)
        ? Math.min(100, Math.max(0, payload.progress))
        : undefined,
  }
}

export const getBookCacheFilename = (bookKey: string): string => {
  return toBookCacheFilename(bookKey)
}

export const loadBookCache = async (bookKey: string): Promise<BookCachePayload | null> => {
  const filename = getBookCacheFilename(bookKey)
  const finishLog = createDurationLogger('book-cache-service', 'load-book-cache', {
    fileName: filename,
  })

  try {
    const payload = normalizeBookCachePayload(
      await readJsonFile<Partial<BookCachePayload> & Record<string, unknown>>(
        buildLocalFilePath(LOCAL_DIRS.cached, filename)
      )
    )
    finishLog({
      fileName: filename,
      hit: true,
    })
    return payload
  } catch {
    finishLog({
      fileName: filename,
      hit: false,
    })
    return null
  }
}

export const saveBookCache = async (
  bookKey: string,
  payload: BookCachePayload
): Promise<BookCachePayload> => {
  const filename = getBookCacheFilename(bookKey)
  const finishLog = createDurationLogger('book-cache-service', 'save-book-cache', {
    fileName: filename,
  })
  const currentCache = (await loadBookCache(bookKey)) || {}
  const nextCache = normalizeBookCachePayload({
    ...currentCache,
    ...payload,
  })

  await writeJsonFile(buildLocalFilePath(LOCAL_DIRS.cached, filename), nextCache)

  finishLog({
    fileName: filename,
    keys: Object.keys(nextCache),
  })
  return nextCache
}

export const hasRequiredBookCache = (
  cache: BookCachePayload
): boolean => {
  return epubBookCacheHandler.hasRequiredCache(cache)
}

export const primeBookCacheAfterImport = async (
  bookKey: string,
  fileBuffer: ArrayBuffer,
  originalFileName: string
): Promise<BookCachePayload> => {
  const finishLog = createDurationLogger('book-cache-service', 'prime-book-cache-after-import', {
    fileName: originalFileName,
  })
  const currentCache = await loadBookCache(bookKey)
  const nextPayload = await epubBookCacheHandler.buildCachePayload({
    fileBuffer,
    originalFileName,
    currentCache: currentCache || {},
  })
  const payload = await saveBookCache(bookKey, nextPayload)
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
    hasCover: Boolean(payload.cover),
    progress: payload.progress,
    locationsStatus,
  })
  return payload
}
