import { invoke } from '@tauri-apps/api/core'
import ePub from 'libs/epub.js'
import { BookConfig } from '@/js/map'
import { BookFormat } from '@/js/bookFormat'
import { getLocalDirNames } from '@/services/fileSystem/dirService'
import { parseEpubMeta } from '@/services/book/parsers/epubParser'
import { splitTextToParagraphs } from '@/services/reader/txtReaderService'
import { toBookCacheFilename } from '@/services/book/bookIdentity'

export interface BookCachePayload {
  cover?: string
  locations?: string
  paragraphCount?: number
  bookFileName?: string
}

type BookCacheIdentity = Pick<BookConfig, 'title' | 'author'>

const toUint8Array = (data: ArrayBufferLike | Uint8Array | number[]): Uint8Array => {
  if (data instanceof Uint8Array) {
    return data
  }

  if (Array.isArray(data)) {
    return Uint8Array.from(data)
  }

  return new Uint8Array(data)
}

export const getBookCacheFilename = (title?: string, author?: string): string => {
  return toBookCacheFilename(title, author)
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

const extractTxtParagraphCount = (fileBuffer: ArrayBuffer): number => {
  const textContent = new TextDecoder().decode(fileBuffer)
  return splitTextToParagraphs(textContent).length
}

export const primeBookCacheAfterImport = async (
  bookConfig: BookCacheIdentity,
  fileBuffer: ArrayBuffer,
  format: BookFormat,
  bookFileName: string
): Promise<BookCachePayload> => {
  if (format !== 'epub') {
    const payload = {
      paragraphCount: extractTxtParagraphCount(fileBuffer),
      bookFileName,
    }
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
      bookFileName,
    })
  } catch (error) {
    console.warn('提取书籍缓存失败:', error)
    const payload = {
      bookFileName,
    }
    await saveBookCache(bookConfig, payload)
    return payload
  }
}
