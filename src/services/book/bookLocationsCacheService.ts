import { toBookCacheFilename } from '@/services/book/bookIdentity'
import {
  buildLocalFilePath,
  LOCAL_DIRS,
  readJsonFile,
  removeLocalFile,
  writeJsonFile,
} from '@/services/fileSystem/localStorageService'
import { createDurationLogger } from '@/utils/logger'

export type BookLocationsCacheStatus = 'ready' | 'building' | 'failed'

export interface BookLocationsCachePayload {
  status: BookLocationsCacheStatus
  locations?: string
}

type RawBookLocationsCachePayload = Partial<BookLocationsCachePayload>

const isBookLocationsCacheStatus = (
  value: unknown
): value is BookLocationsCacheStatus => {
  return value === 'ready' || value === 'building' || value === 'failed'
}

const normalizeBookLocationsCachePayload = (
  payload: RawBookLocationsCachePayload
): BookLocationsCachePayload => {
  const status = isBookLocationsCacheStatus(payload.status)
    ? payload.status
    : 'failed'
  const locations =
    typeof payload.locations === 'string' ? payload.locations : undefined

  if (status === 'ready') {
    if (locations) {
      return {
        status,
        locations,
      }
    }

    return {
      status: 'failed',
    }
  }

  return {
    status,
  }
}

export const getBookLocationsCacheFilename = (bookKey: string): string => {
  return toBookCacheFilename(bookKey)
}

const buildBookLocationsCachePath = (bookKey: string): string => {
  return buildLocalFilePath(
    LOCAL_DIRS.cachedLocations,
    getBookLocationsCacheFilename(bookKey)
  )
}

export const loadBookLocationsCache = async (
  bookKey: string
): Promise<BookLocationsCachePayload | null> => {
  const filename = getBookLocationsCacheFilename(bookKey)
  const finishLog = createDurationLogger(
    'book-locations-cache-service',
    'load-book-locations-cache',
    {
      fileName: filename,
    }
  )

  try {
    const payload = normalizeBookLocationsCachePayload(
      await readJsonFile<RawBookLocationsCachePayload>(
        buildBookLocationsCachePath(bookKey)
      )
    )

    finishLog({
      fileName: filename,
      hit: true,
      status: payload.status,
      ready: payload.status === 'ready',
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

export const saveBookLocationsCache = async (
  bookKey: string,
  payload: BookLocationsCachePayload
): Promise<BookLocationsCachePayload> => {
  const filename = getBookLocationsCacheFilename(bookKey)
  const finishLog = createDurationLogger(
    'book-locations-cache-service',
    'save-book-locations-cache',
    {
      fileName: filename,
    }
  )
  const normalizedPayload = normalizeBookLocationsCachePayload(payload)

  await writeJsonFile(buildBookLocationsCachePath(bookKey), normalizedPayload)

  finishLog({
    fileName: filename,
    status: normalizedPayload.status,
    ready: normalizedPayload.status === 'ready',
  })

  return normalizedPayload
}

export const removeBookLocationsCache = async (bookKey: string): Promise<void> => {
  await removeLocalFile(buildBookLocationsCachePath(bookKey))
}

export const getReadyBookLocations = (
  payload: BookLocationsCachePayload | null | undefined
): string | undefined => {
  if (!payload || payload.status !== 'ready') {
    return undefined
  }

  return payload.locations
}
