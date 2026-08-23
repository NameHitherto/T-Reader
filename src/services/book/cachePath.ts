import { convertFileSrc } from '@tauri-apps/api/core'
import { documentDir, join } from '@tauri-apps/api/path'
import { hashBookKey } from '@/services/book/identity'
import { buildLocalFilePath, LOCAL_DIRS } from '@/services/fileSystem'

const BOOK_CACHE_LOCATIONS_FILENAME = 'locations.json'

export const buildBookCacheDir = async (bookKey: string): Promise<string> => {
  return `${LOCAL_DIRS.cached}/${await hashBookKey(bookKey)}`
}

export const buildBookCacheLocationsPath = async (bookKey: string): Promise<string> => {
  return buildLocalFilePath(await buildBookCacheDir(bookKey), BOOK_CACHE_LOCATIONS_FILENAME)
}

export const buildBookCacheCoverPath = async (
  bookKey: string,
  coverResource: string,
): Promise<string> => {
  return buildLocalFilePath(await buildBookCacheDir(bookKey), coverResource)
}

export const buildBookCacheCoverAssetUrl = async (
  bookKey: string,
  coverResource: string,
): Promise<string> => {
  const relativePath = await buildBookCacheCoverPath(bookKey, coverResource)
  const absolutePath = await join(await documentDir(), relativePath)

  return convertFileSrc(absolutePath)
}
