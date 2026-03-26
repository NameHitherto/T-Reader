import { invoke } from '@tauri-apps/api/core'
import { BookConfig } from '@/js/map'
import {
  BookFormat,
  detectBookFormatFromFilename,
  detectBookFormatFromPath,
} from '@/js/bookFormat'
import { getLocalDirNames } from '@/services/fileSystem/dirService'
import {
  BookCachePayload,
  loadBookCache,
  primeBookCacheAfterImport,
  saveBookCache,
} from '@/services/book/bookCacheService'
import { parseEpubMeta } from '@/services/book/parsers/epubParser'
import { parseTxtMeta } from '@/services/book/parsers/txtParser'
import { buildBookIdentity, toBookConfigFilename } from '@/services/book/bookIdentity'
import {
  createDurationLogger,
  logError,
  logInfo,
  logWarn,
} from '@/utils/logger'

export interface ResolvedBookFile {
  fileName: string
  format: BookFormat
}

export interface LoadedBookBinary extends ResolvedBookFile {
  bookData: Uint8Array
}

let cachedBookFileIndex: Map<string, ResolvedBookFile> | null = null

const toUint8Array = (data: ArrayBufferLike | Uint8Array | number[]): Uint8Array => {
  if (data instanceof Uint8Array) {
    return data
  }

  if (Array.isArray(data)) {
    return Uint8Array.from(data)
  }

  return new Uint8Array(data)
}

const toArrayBuffer = (data: Uint8Array): ArrayBuffer => {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
}

const readLocalBookFile = async (filename: string): Promise<Uint8Array> => {
  const finishLog = createDurationLogger('book-repository', 'read-local-book-file', {
    fileName: filename,
  })
  const dirs = await getLocalDirNames()
  const localData = await invoke('read_file', {
    subdir: dirs.books,
    filename,
  })
  const payload = toUint8Array(localData as ArrayBufferLike | Uint8Array | number[])
  finishLog({
    fileName: filename,
    bytes: payload.byteLength,
  })
  return payload
}

const readCloudBookFile = async (filename: string): Promise<Uint8Array> => {
  const finishLog = createDurationLogger('book-repository', 'read-cloud-book-file', {
    fileName: filename,
  })
  const dirs = await getLocalDirNames()
  const cloudBookData = await invoke('webdav_get', {
    subdir: dirs.books,
    filename,
  })
  const localBookData = toUint8Array(cloudBookData as ArrayBufferLike | Uint8Array | number[])

  await invoke('write_file', {
    subdir: dirs.books,
    filename,
    contents: Array.from(localBookData),
  })

  finishLog({
    fileName: filename,
    bytes: localBookData.byteLength,
  })
  return localBookData
}

const listLocalBookFiles = async (): Promise<string[]> => {
  const dirs = await getLocalDirNames()
  const filenames = await invoke<string[]>('list_files', {
    subdir: dirs.books,
  })

  return filenames.filter((filename) => detectBookFormatFromFilename(filename))
}

const rebuildBookFileIndex = async (): Promise<Map<string, ResolvedBookFile>> => {
  const finishLog = createDurationLogger('book-repository', 'rebuild-book-file-index')
  const filenames = await listLocalBookFiles()
  const entries = new Map<string, ResolvedBookFile>()

  for (const filename of filenames) {
    const format = detectBookFormatFromFilename(filename)
    if (!format) {
      continue
    }

    const bookData = await readLocalBookFile(filename)
    const fileBuffer = toArrayBuffer(bookData)
    const meta =
      format === 'epub' ? await parseEpubMeta(fileBuffer) : parseTxtMeta(filename)
    const identity = buildBookIdentity(meta.title, meta.author)

    if (!entries.has(identity)) {
      entries.set(identity, {
        fileName: filename,
        format,
      })
    }
  }

  cachedBookFileIndex = entries
  finishLog({
    sourceFiles: filenames.length,
    indexedBooks: entries.size,
  })
  return entries
}

const getBookFileFromCache = async (
  bookConfig: Pick<BookConfig, 'id' | 'title' | 'author'>
): Promise<ResolvedBookFile | null> => {
  const cache = await loadBookCache(bookConfig)
  const fileName = cache?.bookFileName
  const format = fileName ? detectBookFormatFromFilename(fileName) : null

  if (!fileName || !format) {
    return null
  }

  return {
    fileName,
    format,
  }
}

const persistResolvedBookFile = async (
  bookConfig: Pick<BookConfig, 'title' | 'author'>,
  resolved: ResolvedBookFile
) => {
  await saveBookCache(bookConfig, {
    bookFileName: resolved.fileName,
  })
}

export const invalidateBookFileIndex = () => {
  cachedBookFileIndex = null
  logInfo('book-repository', 'invalidate-book-file-index')
}

export const loadBookConfigs = async (): Promise<BookConfig[]> => {
  const finishLog = createDurationLogger('book-repository', 'load-book-configs')
  const dirs = await getLocalDirNames()
  const configs = await invoke<BookConfig[]>('load_books', { subdir: dirs.progress })
  finishLog({
    total: configs.length,
  })
  return configs
}

export const loadBookConfig = async (bookId: string): Promise<BookConfig> => {
  const finishLog = createDurationLogger('book-repository', 'load-book-config', {
    bookId,
  })
  const dirs = await getLocalDirNames()
  const filename = toBookConfigFilename(bookId)
  let bookConfigData: Uint8Array

  try {
    const localData = await invoke('read_file', {
      subdir: dirs.progress,
      filename,
    })
    bookConfigData = toUint8Array(localData as ArrayBufferLike | Uint8Array | number[])
  } catch (localError) {
    const cloudConfigData = await invoke('webdav_get', {
      subdir: dirs.progress,
      filename,
    })
    bookConfigData = toUint8Array(cloudConfigData as ArrayBufferLike | Uint8Array | number[])

    await invoke('write_file', {
      subdir: dirs.progress,
      filename,
      contents: Array.from(bookConfigData),
    })
    logWarn('book-repository', 'load-book-config fallback-to-cloud', {
      bookId,
      fileName: filename,
    })
  }

  const config = JSON.parse(new TextDecoder().decode(bookConfigData)) as BookConfig
  finishLog({
    bookId,
    title: config.title,
  })
  return config
}

export const loadBookCacheByConfig = async (
  bookConfig: Pick<BookConfig, 'title' | 'author'>
) => {
  return loadBookCache(bookConfig)
}

export const saveBookConfig = async (bookId: string, config: BookConfig): Promise<void> => {
  const finishLog = createDurationLogger('book-repository', 'save-book-config', {
    bookId,
  })
  const nextConfig: BookConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  }
  const jsonString = JSON.stringify(nextConfig)
  const jsonUint8Array = new TextEncoder().encode(jsonString)
  const dirs = await getLocalDirNames()
  const filename = toBookConfigFilename(bookId)

  await invoke('save_file', {
    subdir: dirs.progress,
    filename,
    contents: jsonString,
  })

  await invoke('webdav_upload', {
    subdir: dirs.progress,
    filename,
    contents: Array.from(jsonUint8Array),
  })

  finishLog({
    bookId,
    bytes: jsonUint8Array.byteLength,
  })
}

export const resolveBookFile = async (
  bookConfig: Pick<BookConfig, 'id' | 'title' | 'author'>
): Promise<ResolvedBookFile> => {
  const finishLog = createDurationLogger('book-repository', 'resolve-book-file', {
    bookId: bookConfig.id,
  })
  const cachedResolved = await getBookFileFromCache(bookConfig)
  if (cachedResolved) {
    finishLog({
      bookId: bookConfig.id,
      source: 'cache',
      fileName: cachedResolved.fileName,
      format: cachedResolved.format,
    })
    return cachedResolved
  }

  if (!cachedBookFileIndex) {
    await rebuildBookFileIndex()
  }

  const indexed = cachedBookFileIndex?.get(bookConfig.id)
  if (indexed) {
    await persistResolvedBookFile(bookConfig, indexed)
    finishLog({
      bookId: bookConfig.id,
      source: 'memory-index',
      fileName: indexed.fileName,
      format: indexed.format,
    })
    return indexed
  }

  const rebuiltIndex = await rebuildBookFileIndex()
  const rebuilt = rebuiltIndex.get(bookConfig.id)
  if (!rebuilt) {
    logError('book-repository', 'resolve-book-file missing', undefined, {
      bookId: bookConfig.id,
    })
    throw new Error(`Book file not found for ${bookConfig.id}`)
  }

  await persistResolvedBookFile(bookConfig, rebuilt)
  finishLog({
    bookId: bookConfig.id,
    source: 'rebuilt-index',
    fileName: rebuilt.fileName,
    format: rebuilt.format,
  })
  return rebuilt
}

export const resolveBookFormat = async (
  bookConfig: Pick<BookConfig, 'id' | 'title' | 'author'>
): Promise<BookFormat> => {
  const resolved = await resolveBookFile(bookConfig)
  return resolved.format
}

export const ensureBookCache = async (
  bookConfig: Pick<BookConfig, 'id' | 'title' | 'author'>
): Promise<BookCachePayload> => {
  const finishLog = createDurationLogger('book-repository', 'ensure-book-cache', {
    bookId: bookConfig.id,
  })
  const currentCache = (await loadBookCache(bookConfig)) || {}
  const resolved = await resolveBookFile(bookConfig)
  const hasRequiredCache =
    resolved.format === 'epub'
      ? Boolean(currentCache.bookFileName && currentCache.locations)
      : Boolean(currentCache.bookFileName && currentCache.paragraphCount)

  if (hasRequiredCache && (resolved.format !== 'epub' || currentCache.cover !== undefined)) {
    finishLog({
      bookId: bookConfig.id,
      source: 'existing-cache',
      format: resolved.format,
    })
    return currentCache
  }

  const bookData = await loadBookBinary(bookConfig)
  const payload = await primeBookCacheAfterImport(
    bookConfig,
    toArrayBuffer(bookData.bookData),
    bookData.format,
    bookData.fileName
  )
  finishLog({
    bookId: bookConfig.id,
    source: 'rebuilt-cache',
    format: bookData.format,
  })
  return payload
}

export const loadBookBinary = async (
  bookConfig: Pick<BookConfig, 'id' | 'title' | 'author'>
): Promise<LoadedBookBinary> => {
  const finishLog = createDurationLogger('book-repository', 'load-book-binary', {
    bookId: bookConfig.id,
  })
  const resolved = await resolveBookFile(bookConfig)

  try {
    const localBookData = await readLocalBookFile(resolved.fileName)
    const payload = {
      ...resolved,
      bookData: localBookData,
    }
    finishLog({
      bookId: bookConfig.id,
      source: 'local',
      bytes: localBookData.byteLength,
      fileName: resolved.fileName,
    })
    return payload
  } catch (localError) {
    logWarn('book-repository', 'load-book-binary fallback-to-cloud', {
      bookId: bookConfig.id,
      fileName: resolved.fileName,
    })
    const cloudBookData = await readCloudBookFile(resolved.fileName)
    const payload = {
      ...resolved,
      bookData: cloudBookData,
    }
    finishLog({
      bookId: bookConfig.id,
      source: 'cloud',
      bytes: cloudBookData.byteLength,
      fileName: resolved.fileName,
    })
    return payload
  }
}

export const getImportedBookIdentity = async (
  fileName: string,
  fileBuffer: ArrayBuffer
): Promise<{ id: string; format: BookFormat }> => {
  const finishLog = createDurationLogger('book-repository', 'get-imported-book-identity', {
    fileName,
  })
  const format = detectBookFormatFromPath(fileName)
  if (!format) {
    throw new Error(`Unsupported file format: ${fileName}`)
  }

  const meta = format === 'epub' ? await parseEpubMeta(fileBuffer) : parseTxtMeta(fileName)

  const payload = {
    id: buildBookIdentity(meta.title, meta.author),
    format,
  }
  finishLog({
    fileName,
    bookId: payload.id,
    format,
  })
  return payload
}

export const hasOriginalFilenameConflict = async (fileName: string): Promise<boolean> => {
  const filenames = await listLocalBookFiles()
  const exists = filenames.includes(fileName)
  if (exists) {
    logWarn('book-repository', 'original-file-name-conflict', {
      fileName,
    })
  }
  return exists
}
