import { epubBookCacheHandler, extractEpubLocations } from '@/services/book/epub/epubCacheService'
import {
  buildBookCacheCoverAssetUrl,
  buildBookCacheDataPath,
  buildBookCacheDir,
} from '@/services/book/bookCachePathService'
import { saveBookLocationsCache } from '@/services/book/bookLocationsCacheService'
import { createDurationLogger, logWarn } from '@/utils/logger'
import {
  ensureLocalDir,
  readJsonFile,
  removeLocalDir,
  writeJsonFile,
} from '@/services/fileSystem/localStorageService'

export interface BookCachePayload {
  title?: string
  coverResource?: string | null
  coverUrl?: string
  progress?: number
}

const COVER_RESOURCE_FILENAME = /^cover\.[a-z0-9]+$/i

const normalizeCoverResource = (value: unknown): string | null | undefined => {
  if (value === null) {
    return null
  }

  if (typeof value === 'string' && COVER_RESOURCE_FILENAME.test(value)) {
    return value
  }

  return undefined
}

const normalizeBookCachePayload = (
  payload: Partial<BookCachePayload> & Record<string, unknown>,
): BookCachePayload => {
  return {
    title: typeof payload.title === 'string' ? payload.title : undefined,
    coverResource: normalizeCoverResource(payload.coverResource),
    progress:
      typeof payload.progress === 'number' && Number.isFinite(payload.progress)
        ? Math.min(100, Math.max(0, payload.progress))
        : undefined,
  }
}

const withBookCacheRuntimeFields = async (
  bookKey: string,
  cache: BookCachePayload,
): Promise<BookCachePayload> => {
  if (!cache.coverResource) {
    return cache
  }

  return {
    ...cache,
    coverUrl: await buildBookCacheCoverAssetUrl(bookKey, cache.coverResource),
  }
}

const toStoredBookCachePayload = (payload: BookCachePayload): BookCachePayload => {
  return normalizeBookCachePayload({ ...payload })
}

export const removeBookCacheDir = async (bookKey: string): Promise<void> => {
  await removeLocalDir(await buildBookCacheDir(bookKey))
}

export const loadBookCache = async (bookKey: string): Promise<BookCachePayload | null> => {
  try {
    return await withBookCacheRuntimeFields(
      bookKey,
      normalizeBookCachePayload(
        await readJsonFile<Partial<BookCachePayload> & Record<string, unknown>>(
          await buildBookCacheDataPath(bookKey),
        ),
      ),
    )
  } catch {
    return null
  }
}

export const saveBookCache = async (
  bookKey: string,
  payload: BookCachePayload,
): Promise<BookCachePayload> => {
  const cacheDir = await buildBookCacheDir(bookKey)
  const currentCache = (await loadBookCache(bookKey)) || {}
  const nextCache = normalizeBookCachePayload({
    ...currentCache,
    ...payload,
  })

  await ensureLocalDir(cacheDir)
  await writeJsonFile(await buildBookCacheDataPath(bookKey), toStoredBookCachePayload(nextCache))

  return await withBookCacheRuntimeFields(bookKey, nextCache)
}

export const hasRequiredBookCache = (cache: BookCachePayload): boolean => {
  return epubBookCacheHandler.hasRequiredCache(cache)
}

export const primeBookCacheAfterImport = async (
  bookKey: string,
  fileBuffer: ArrayBuffer,
  originalFileName: string,
): Promise<BookCachePayload> => {
  const finishLog = createDurationLogger('book-cache-service', 'prime-book-cache-after-import', {
    fileName: originalFileName,
  })
  const currentCache = await loadBookCache(bookKey)
  const nextPayload = await epubBookCacheHandler.buildCachePayload({
    bookKey,
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
    hasCover: Boolean(payload.coverResource),
    progress: payload.progress,
    locationsStatus,
  })
  return payload
}
