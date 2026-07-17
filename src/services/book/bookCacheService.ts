import { extractEpubLocations, saveEpubCoverResource } from '@/services/book/epub/epubCacheService'
import {
  buildBookCacheCoverAssetUrl,
  buildBookCacheCoverPath,
  buildBookCacheDir,
  buildBookCacheLocationsPath,
} from '@/services/book/bookCachePathService'
import { saveBookLocationsCache } from '@/services/book/bookLocationsCacheService'
import { loadBookBinary, updateBookCover } from '@/services/book/bookRepository'
import type { StoredBookRecord } from '@/services/book/bookRepositoryTypes'
import { createDurationLogger, logInfo, logWarn } from '@/utils/logger'
import {
  ensureLocalDir,
  localPathExists,
  readBinaryFile,
  removeLocalDir,
  removeLocalFile,
  writeBinaryFile,
} from '@/services/fileSystem/localStorageService'

export interface ResolveBookCoverOptions {
  onCoverUpdated?: (book: StoredBookRecord) => void | Promise<void>
}

const pendingCoverParseBookKeys = new Set<string>()

export const buildBookCoverUrl = async (
  bookKey: string,
  coverResource?: string | null,
): Promise<string | undefined> => {
  if (!coverResource) {
    return undefined
  }

  if (!(await localPathExists(await buildBookCacheCoverPath(bookKey, coverResource)))) {
    return undefined
  }

  return await buildBookCacheCoverAssetUrl(bookKey, coverResource)
}

export const removeBookCacheDir = async (bookKey: string): Promise<void> => {
  await removeLocalDir(await buildBookCacheDir(bookKey))
}

export const saveUploadedBookCover = async (
  bookKey: string,
  bytes: Uint8Array,
  extension: 'jpg' | 'png' | 'webp',
): Promise<string> => {
  const coverName = `cover.${extension}`
  await ensureLocalDir(await buildBookCacheDir(bookKey))
  await writeBinaryFile(await buildBookCacheCoverPath(bookKey, coverName), bytes)
  return coverName
}

export const migrateBookCache = async (
  oldBookKey: string,
  newBookKey: string,
  coverName?: string | null,
): Promise<void> => {
  if (oldBookKey === newBookKey) {
    return
  }

  const oldDir = await buildBookCacheDir(oldBookKey)
  const newDir = await buildBookCacheDir(newBookKey)
  await ensureLocalDir(newDir)

  const locationsPath = await buildBookCacheLocationsPath(oldBookKey)
  if (await localPathExists(locationsPath)) {
    await writeBinaryFile(
      await buildBookCacheLocationsPath(newBookKey),
      await readBinaryFile(locationsPath),
    )
  }

  if (coverName) {
    const oldCoverPath = await buildBookCacheCoverPath(oldBookKey, coverName)
    if (await localPathExists(oldCoverPath)) {
      await writeBinaryFile(
        await buildBookCacheCoverPath(newBookKey, coverName),
        await readBinaryFile(oldCoverPath),
      )
    }
  }

  await removeLocalDir(oldDir)
}

export const removeBookCoverResource = async (
  bookKey: string,
  coverName?: string | null,
): Promise<void> => {
  if (!coverName) {
    return
  }

  await removeLocalFile(await buildBookCacheCoverPath(bookKey, coverName))
}

export const parseBookCoverInBackground = (
  book: StoredBookRecord,
  options: ResolveBookCoverOptions = {},
) => {
  if (!book.hasCover || pendingCoverParseBookKeys.has(book.bookKey)) {
    return
  }

  pendingCoverParseBookKeys.add(book.bookKey)

  void (async () => {
    try {
      const loadedBook = await loadBookBinary(book.bookKey)
      if (loadedBook.format !== 'epub') {
        const updatedBook = await updateBookCover(book.bookKey, false, null)
        await options.onCoverUpdated?.(updatedBook)
        return
      }

      const fileBuffer = loadedBook.bookData.buffer.slice(
        loadedBook.bookData.byteOffset,
        loadedBook.bookData.byteOffset + loadedBook.bookData.byteLength,
      ) as ArrayBuffer
      const coverName = await saveEpubCoverResource(book.bookKey, fileBuffer)
      const updatedBook = await updateBookCover(book.bookKey, Boolean(coverName), coverName)
      await options.onCoverUpdated?.(updatedBook)
      logInfo('book-cache-service', 'parse-book-cover:done', {
        bookKey: book.bookKey,
        hasCover: Boolean(coverName),
        coverName,
      })
    } catch (error) {
      logWarn('book-cache-service', 'parse-book-cover failed', {
        bookKey: book.bookKey,
        error,
      })
    } finally {
      pendingCoverParseBookKeys.delete(book.bookKey)
    }
  })()
}

export const resolveBookCoverForDisplay = async (
  book: StoredBookRecord,
  defaultCover: string,
  options: ResolveBookCoverOptions = {},
): Promise<string> => {
  if (!book.hasCover) {
    return defaultCover
  }

  if (book.coverName) {
    try {
      const coverUrl = await buildBookCoverUrl(book.bookKey, book.coverName)
      if (coverUrl) {
        return coverUrl
      }
    } catch (error) {
      logWarn('book-cache-service', 'resolve-book-cover-url failed', {
        bookKey: book.bookKey,
        coverName: book.coverName,
        error,
      })
    }
  }

  parseBookCoverInBackground(book, options)
  return defaultCover
}

export const primeBookLocationsAfterImport = async (
  bookKey: string,
  fileBuffer: ArrayBuffer,
  originalFileName: string,
): Promise<void> => {
  const finishLog = createDurationLogger(
    'book-cache-service',
    'prime-book-locations-after-import',
    {
      fileName: originalFileName,
    },
  )
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
    locationsStatus,
  })
}
