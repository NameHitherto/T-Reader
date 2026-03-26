import { invoke } from '@tauri-apps/api/core'
import ePub from 'libs/epub.js'
import { BookConfig } from '@/js/map'
import { BookFormat } from '@/js/bookFormat'
import { getLocalDirNames } from '@/services/fileSystem/dirService'
import { parseEpubMeta } from '@/services/book/parsers/epubParser'
import { splitTextToParagraphs } from '@/services/reader/txtReaderService'
import { toBookCacheFilename } from '@/services/book/bookIdentity'
import { createDurationLogger, logWarn } from '@/utils/logger'

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
  const filename = getBookCacheFilename(bookConfig.title, bookConfig.author)
  const finishLog = createDurationLogger('book-cache-service', 'load-book-cache', {
    fileName: filename,
  })
  const dirs = await getLocalDirNames()

  try {
    const fileData = await invoke('read_file', {
      subdir: dirs.cached,
      filename,
    })
    const decoded = new TextDecoder().decode(
      toUint8Array(fileData as ArrayBufferLike | Uint8Array | number[])
    )
    const payload = JSON.parse(decoded) as BookCachePayload
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
  bookConfig: Pick<BookConfig, 'title' | 'author'>,
  payload: BookCachePayload
): Promise<BookCachePayload> => {
  const filename = getBookCacheFilename(bookConfig.title, bookConfig.author)
  const finishLog = createDurationLogger('book-cache-service', 'save-book-cache', {
    fileName: filename,
  })
  const dirs = await getLocalDirNames()
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

  finishLog({
    fileName: filename,
    keys: Object.keys(nextCache),
  })
  return nextCache
}

const extractEpubLocations = async (fileBuffer: ArrayBuffer): Promise<string> => {
  const finishLog = createDurationLogger('book-cache-service', 'extract-epub-locations')
  const book = ePub(fileBuffer)

  try {
    await book.ready
    await book.locations.generate(1000)
    const locations = book.locations.save()
    finishLog({
      locationLength: locations.length,
    })
    return locations
  } finally {
    try {
      book.destroy?.()
    } catch (error) {
      logWarn('book-cache-service', 'release-epub-locations-instance failed', {
        error,
      })
    }
  }
}

const extractTxtParagraphCount = (fileBuffer: ArrayBuffer): number => {
  const finishLog = createDurationLogger('book-cache-service', 'extract-txt-paragraph-count')
  const textContent = new TextDecoder().decode(fileBuffer)
  const paragraphCount = splitTextToParagraphs(textContent).length
  finishLog({
    paragraphCount,
    textLength: textContent.length,
  })
  return paragraphCount
}

export const primeBookCacheAfterImport = async (
  bookConfig: BookCacheIdentity,
  fileBuffer: ArrayBuffer,
  format: BookFormat,
  bookFileName: string
): Promise<BookCachePayload> => {
  const finishLog = createDurationLogger('book-cache-service', 'prime-book-cache-after-import', {
    fileName: bookFileName,
    format,
  })

  if (format !== 'epub') {
    const payload = {
      paragraphCount: extractTxtParagraphCount(fileBuffer),
      bookFileName,
    }
    await saveBookCache(bookConfig, payload)
    finishLog({
      fileName: bookFileName,
      format,
      paragraphCount: payload.paragraphCount,
    })
    return payload
  }

  try {
    const [meta, locations] = await Promise.all([
      parseEpubMeta(fileBuffer, { includeCover: true }),
      extractEpubLocations(fileBuffer),
    ])
    const payload = await saveBookCache(bookConfig, {
      cover: meta.cover || '',
      locations,
      bookFileName,
    })
    finishLog({
      fileName: bookFileName,
      format,
      hasCover: Boolean(payload.cover),
      hasLocations: Boolean(payload.locations),
    })
    return payload
  } catch (error) {
    logWarn('book-cache-service', 'prime-book-cache-after-import fallback', {
      fileName: bookFileName,
      format,
      error,
    })
    const payload = {
      bookFileName,
    }
    await saveBookCache(bookConfig, payload)
    finishLog({
      fileName: bookFileName,
      format,
      fallback: true,
    })
    return payload
  }
}
