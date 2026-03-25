import { invoke } from '@tauri-apps/api/core'
import ePub from 'libs/epub.js'
import { BookConfig } from '@/js/map'
import { getLocalDirNames } from '@/services/fileSystem/dirService'
import { parseEpubMeta } from '@/services/book/parsers/epubParser'

export interface BookCachePayload {
  cover?: string
  locations?: string
}

type BookCacheIdentity = Pick<BookConfig, 'title' | 'author' | 'format'>

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g
const MULTIPLE_SPACES = /\s+/g

const toUint8Array = (data: ArrayBufferLike | Uint8Array | number[]): Uint8Array => {
  if (data instanceof Uint8Array) {
    return data
  }

  if (Array.isArray(data)) {
    return Uint8Array.from(data)
  }

  return new Uint8Array(data)
}

const sanitizeCacheNamePart = (value?: string, fallback = 'unknown'): string => {
  const sanitized = (value || '')
    .replace(INVALID_FILENAME_CHARS, '_')
    .replace(MULTIPLE_SPACES, ' ')
    .trim()

  return sanitized || fallback
}

export const getBookCacheFilename = (title?: string, author?: string): string => {
  const safeTitle = sanitizeCacheNamePart(title, 'untitled')
  const safeAuthor = sanitizeCacheNamePart(author, 'unknown')
  return `${safeTitle}_${safeAuthor}.json`
}

export const loadBookCache = async (
  bookConfig: Pick<BookConfig, 'title' | 'author'>
): Promise<BookCachePayload | null> => {
  const dirs = await getLocalDirNames()
  const filename = getBookCacheFilename(bookConfig.title, bookConfig.author)

  try {
    const fileData = await invoke('read_file', {
      subdir: dirs.cached,
      filename,
    })
    const decoded = new TextDecoder().decode(
      toUint8Array(fileData as ArrayBufferLike | Uint8Array | number[])
    )
    return JSON.parse(decoded) as BookCachePayload
  } catch (error) {
    return null
  }
}

export const saveBookCache = async (
  bookConfig: Pick<BookConfig, 'title' | 'author'>,
  payload: BookCachePayload
): Promise<BookCachePayload> => {
  const dirs = await getLocalDirNames()
  const filename = getBookCacheFilename(bookConfig.title, bookConfig.author)
  const currentCache = (await loadBookCache(bookConfig)) || {}
  const nextCache = {
    ...currentCache,
    ...payload,
  }

  await invoke('save_file', {
    subdir: dirs.cached,
    filename,
    contents: JSON.stringify(nextCache),
  })

  return nextCache
}

const extractEpubLocations = async (fileBuffer: ArrayBuffer): Promise<string> => {
  const book = ePub(fileBuffer)

  try {
    await book.ready
    await book.locations.generate(1000)
    return book.locations.save()
  } finally {
    try {
      book.destroy?.()
    } catch (error) {
      console.warn('释放 EPUB locations 实例失败:', error)
    }
  }
}

export const primeBookCacheAfterImport = async (
  bookConfig: BookCacheIdentity,
  fileBuffer: ArrayBuffer
): Promise<BookCachePayload> => {
  if (bookConfig.format !== 'epub') {
    const payload = {}
    await saveBookCache(bookConfig, payload)
    return payload
  }

  try {
    const [meta, locations] = await Promise.all([
      parseEpubMeta(fileBuffer, { includeCover: true }),
      extractEpubLocations(fileBuffer),
    ])
    return await saveBookCache(bookConfig, {
      cover: meta.cover || '',
      locations,
    })
  } catch (error) {
    console.warn('提取书籍缓存失败:', error)
    const payload = {}
    await saveBookCache(bookConfig, payload)
    return payload
  }
}
