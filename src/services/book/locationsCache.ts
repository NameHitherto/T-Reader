import {
  buildBookCacheDir,
  buildBookCacheLocationsPath,
} from '@/services/book/cachePath'
import type { BookLocationsCachePayload, BookLocationsCacheStatus } from '@/services/book/types'
import {
  ensureLocalDir,
  readJsonFile,
  removeLocalFile,
  writeJsonFile,
} from '@/services/fileSystem/localStorageService'

export type { BookLocationsCachePayload, BookLocationsCacheStatus }

type RawBookLocationsCachePayload = Partial<BookLocationsCachePayload>

const isBookLocationsCacheStatus = (value: unknown): value is BookLocationsCacheStatus => {
  return value === 'ready' || value === 'building' || value === 'failed'
}

const normalizeBookLocationsCachePayload = (
  payload: RawBookLocationsCachePayload,
): BookLocationsCachePayload => {
  const status = isBookLocationsCacheStatus(payload.status) ? payload.status : 'failed'
  const locations = typeof payload.locations === 'string' ? payload.locations : undefined

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

export const loadBookLocationsCache = async (
  bookKey: string,
): Promise<BookLocationsCachePayload | null> => {
  try {
    return normalizeBookLocationsCachePayload(
      await readJsonFile<RawBookLocationsCachePayload>(await buildBookCacheLocationsPath(bookKey)),
    )
  } catch {
    return null
  }
}

export const saveBookLocationsCache = async (
  bookKey: string,
  payload: BookLocationsCachePayload,
): Promise<BookLocationsCachePayload> => {
  const normalizedPayload = normalizeBookLocationsCachePayload(payload)

  await ensureLocalDir(await buildBookCacheDir(bookKey))
  await writeJsonFile(await buildBookCacheLocationsPath(bookKey), normalizedPayload)

  return normalizedPayload
}

export const removeBookLocationsCache = async (bookKey: string): Promise<void> => {
  await removeLocalFile(await buildBookCacheLocationsPath(bookKey))
}

export const getReadyBookLocations = (
  payload: BookLocationsCachePayload | null | undefined,
): string | undefined => {
  if (!payload || payload.status !== 'ready') {
    return undefined
  }

  return payload.locations
}
