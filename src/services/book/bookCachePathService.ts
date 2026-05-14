import { hashBookKey } from '@/services/book/bookIdentity'
import { buildLocalFilePath, LOCAL_DIRS } from '@/services/fileSystem/localStorageService'

const BOOK_CACHE_DATA_FILENAME = 'data.json'
const BOOK_CACHE_LOCATIONS_FILENAME = 'locations.json'

export const buildBookCacheDir = async (bookKey: string): Promise<string> => {
  return `${LOCAL_DIRS.cached}/${await hashBookKey(bookKey)}`
}

export const buildBookCacheDataPath = async (bookKey: string): Promise<string> => {
  return buildLocalFilePath(await buildBookCacheDir(bookKey), BOOK_CACHE_DATA_FILENAME)
}

export const buildBookCacheLocationsPath = async (bookKey: string): Promise<string> => {
  return buildLocalFilePath(await buildBookCacheDir(bookKey), BOOK_CACHE_LOCATIONS_FILENAME)
}
