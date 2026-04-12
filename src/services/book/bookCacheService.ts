import { BookFormat } from '@/types/book'
import { epubBookCacheHandler } from '@/services/book/epub/epubCacheService'
import { txtBookCacheHandler } from '@/services/book/txt/txtCacheService'
import { toBookCacheFilename } from '@/services/book/bookIdentity'
import { createDurationLogger } from '@/utils/logger'
import {
  buildLocalFilePath,
  LOCAL_DIRS,
  readJsonFile,
  writeJsonFile,
} from '@/services/fileSystem/localStorageService'

export interface BookCachePayload {
  title?: string
  cover?: string
  locations?: string
  paragraphCount?: number
  progress?: number
}

const normalizeBookCachePayload = (payload: Partial<BookCachePayload> & Record<string, unknown>): BookCachePayload => {
  return {
    title: typeof payload.title === 'string' ? payload.title : undefined,
    cover: typeof payload.cover === 'string' ? payload.cover : undefined,
    locations: typeof payload.locations === 'string' ? payload.locations : undefined,
    paragraphCount:
      typeof payload.paragraphCount === 'number' ? payload.paragraphCount : undefined,
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
  } catch (error) {
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

const BOOK_CACHE_HANDLERS = {
  epub: epubBookCacheHandler,
  txt: txtBookCacheHandler,
} as const

export const hasRequiredBookCache = (
  format: BookFormat,
  cache: BookCachePayload
): boolean => {
  return BOOK_CACHE_HANDLERS[format].hasRequiredCache(cache)
}

export const primeBookCacheAfterImport = async (
  bookKey: string,
  fileBuffer: ArrayBuffer,
  format: BookFormat,
  originalFileName: string
): Promise<BookCachePayload> => {
  const finishLog = createDurationLogger('book-cache-service', 'prime-book-cache-after-import', {
    fileName: originalFileName,
    format,
  })
  const currentCache = await loadBookCache(bookKey)
  const nextPayload = await BOOK_CACHE_HANDLERS[format].buildCachePayload({
    fileBuffer,
    originalFileName,
    currentCache: currentCache || {},
  })
  const payload = await saveBookCache(bookKey, nextPayload)

  finishLog({
    fileName: originalFileName,
    format,
    hasCover: Boolean(payload.cover),
    hasLocations: Boolean(payload.locations),
    paragraphCount: payload.paragraphCount,
    progress: payload.progress,
  })
  return payload
}
