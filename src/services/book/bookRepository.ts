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
import {
  buildBookName,
  buildBookTitle,
  getBookKeyFromConfigFilename,
  toBookConfigFilename,
} from '@/services/book/bookIdentity'
import { normalizeBookConfig } from '@/services/reader/progressSnapshotService'
import {
  createDurationLogger,
  logError,
  logInfo,
  logWarn,
} from '@/utils/logger'
import { encodeJson, stringifyJson } from '@/utils/json'

export interface ResolvedBookFile {
  fileName: string
  format: BookFormat
}

export interface LoadedBookBinary extends ResolvedBookFile {
  bookData: Uint8Array
}

export interface StoredBookConfig {
  bookKey: string
  config: BookConfig
}

interface StoredBookPayload {
  filename: string
  book: BookConfig
}

let cachedBookFileIndex: Map<string, ResolvedBookFile> | null = null

const toPersistedBookConfig = (config: BookConfig): BookConfig => {
  return normalizeBookConfig({
    ...config,
    durChapterTime:
      typeof config.durChapterTime === 'number' ? config.durChapterTime : Date.now(),
  })
}

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

const parseBookConfigData = (data: Uint8Array): BookConfig => {
  const decoded = new TextDecoder().decode(data)
  const parsed = JSON.parse(decoded) as Partial<BookConfig> & Record<string, unknown>
  return normalizeBookConfig(parsed)
}

const getDurChapterTime = (config: Partial<BookConfig> | null | undefined): number => {
  if (!config || typeof config.durChapterTime !== 'number' || Number.isNaN(config.durChapterTime)) {
    return 0
  }

  return config.durChapterTime
}

const persistBookConfigToLocal = async (filename: string, config: BookConfig): Promise<void> => {
  const dirs = await getLocalDirNames()
  await invoke('save_file', {
    subdir: dirs.progress,
    filename,
    contents: stringifyJson(toPersistedBookConfig(config)),
  })
}

const persistBookConfigToCloud = async (filename: string, config: BookConfig): Promise<void> => {
  const dirs = await getLocalDirNames()
  await invoke('webdav_upload', {
    subdir: dirs.progress,
    filename,
    contents: Array.from(encodeJson(toPersistedBookConfig(config))),
  })
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
    const bookName = buildBookName(meta.title, meta.author)

    if (!entries.has(bookName)) {
      entries.set(bookName, {
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
  bookKey: string
): Promise<ResolvedBookFile | null> => {
  const cache = await loadBookCache(bookKey)
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
  bookKey: string,
  resolved: ResolvedBookFile
) => {
  await saveBookCache(bookKey, {
    bookFileName: resolved.fileName,
  })
}

export const invalidateBookFileIndex = () => {
  cachedBookFileIndex = null
  logInfo('book-repository', 'invalidate-book-file-index')
}

export const loadBookConfigs = async (): Promise<StoredBookConfig[]> => {
  const finishLog = createDurationLogger('book-repository', 'load-book-configs')
  const dirs = await getLocalDirNames()
  const storedBooks = await invoke<StoredBookPayload[]>('load_books', { subdir: dirs.progress })
  const normalizedConfigs = storedBooks.map((entry) => ({
    bookKey: getBookKeyFromConfigFilename(entry.filename),
    config: normalizeBookConfig(entry.book),
  }))
  finishLog({
    total: normalizedConfigs.length,
  })
  return normalizedConfigs
}

export const loadBookConfig = async (bookKey: string): Promise<BookConfig> => {
  const finishLog = createDurationLogger('book-repository', 'load-book-config', {
    bookKey,
  })
  const dirs = await getLocalDirNames()
  const filename = toBookConfigFilename(bookKey)
  const [localResult, cloudResult] = await Promise.allSettled([
    invoke('read_file', {
      subdir: dirs.progress,
      filename,
    }).then((data) => parseBookConfigData(toUint8Array(data as ArrayBufferLike | Uint8Array | number[]))),
    invoke('webdav_get', {
      subdir: dirs.progress,
      filename,
    }).then((data) => parseBookConfigData(toUint8Array(data as ArrayBufferLike | Uint8Array | number[]))),
  ])

  const localConfig = localResult.status === 'fulfilled' ? localResult.value : null
  const cloudConfig = cloudResult.status === 'fulfilled' ? cloudResult.value : null

  if (!localConfig && !cloudConfig) {
    throw new Error(`Book config not found for ${bookKey}`)
  }

  const localTime = getDurChapterTime(localConfig)
  const cloudTime = getDurChapterTime(cloudConfig)
  const shouldUseCloud = Boolean(cloudConfig) && (!localConfig || cloudTime > localTime)
  const config = shouldUseCloud ? (cloudConfig as BookConfig) : (localConfig as BookConfig)

  if (shouldUseCloud) {
    await persistBookConfigToLocal(filename, config)
    logWarn('book-repository', 'load-book-config select-cloud', {
      bookKey,
      fileName: filename,
      localTime,
      cloudTime,
    })
  } else if (localConfig && (!cloudConfig || localTime > cloudTime)) {
    try {
      await persistBookConfigToCloud(filename, config)
    } catch (error) {
      logWarn('book-repository', 'load-book-config sync-local-to-cloud failed', {
        bookKey,
        fileName: filename,
        error,
      })
    }
  } else if (!localConfig) {
    await persistBookConfigToLocal(filename, config)
  }

  finishLog({
    bookKey,
    source: shouldUseCloud ? 'cloud' : 'local',
    durChapterTime: getDurChapterTime(config),
  })
  return config
}

export const loadBookCacheByKey = async (
  bookKey: string
) => {
  return loadBookCache(bookKey)
}

export const saveBookConfig = async (
  bookKey: string,
  config: BookConfig
): Promise<void> => {
  const finishLog = createDurationLogger('book-repository', 'save-book-config', {
    bookKey,
  })
  const filename = toBookConfigFilename(bookKey)
  const persisted = toPersistedBookConfig(config)
  const jsonBytes = encodeJson(persisted)

  await persistBookConfigToLocal(filename, persisted)
  await persistBookConfigToCloud(filename, persisted)

  finishLog({
    bookKey,
    bytes: jsonBytes.byteLength,
  })
}

export const resolveBookFile = async (
  bookKey: string
): Promise<ResolvedBookFile> => {
  const finishLog = createDurationLogger('book-repository', 'resolve-book-file', {
    bookKey,
  })
  const cachedResolved = await getBookFileFromCache(bookKey)
  if (cachedResolved) {
    finishLog({
      bookKey,
      source: 'cache',
      fileName: cachedResolved.fileName,
      format: cachedResolved.format,
    })
    return cachedResolved
  }

  if (!cachedBookFileIndex) {
    await rebuildBookFileIndex()
  }

  const indexed = cachedBookFileIndex?.get(bookKey)
  if (indexed) {
    await persistResolvedBookFile(bookKey, indexed)
    finishLog({
      bookKey,
      source: 'memory-index',
      fileName: indexed.fileName,
      format: indexed.format,
    })
    return indexed
  }

  const rebuiltIndex = await rebuildBookFileIndex()
  const rebuilt = rebuiltIndex.get(bookKey)
  if (!rebuilt) {
    logError('book-repository', 'resolve-book-file missing', undefined, {
      bookKey,
    })
    throw new Error(`Book file not found for ${bookKey}`)
  }

  await persistResolvedBookFile(bookKey, rebuilt)
  finishLog({
    bookKey,
    source: 'rebuilt-index',
    fileName: rebuilt.fileName,
    format: rebuilt.format,
  })
  return rebuilt
}

export const resolveBookFormat = async (
  bookKey: string
): Promise<BookFormat> => {
  const resolved = await resolveBookFile(bookKey)
  return resolved.format
}

export const ensureBookCache = async (
  bookKey: string
): Promise<BookCachePayload> => {
  const finishLog = createDurationLogger('book-repository', 'ensure-book-cache', {
    bookKey,
  })
  const currentCache = (await loadBookCache(bookKey)) || {}
  const resolved = await resolveBookFile(bookKey)
  const hasRequiredCache =
    resolved.format === 'epub'
      ? Boolean(currentCache.bookFileName && currentCache.locations && currentCache.title)
      : Boolean(currentCache.bookFileName && currentCache.paragraphCount && currentCache.title)

  if (hasRequiredCache && (resolved.format !== 'epub' || currentCache.cover !== undefined)) {
    finishLog({
      bookKey,
      source: 'existing-cache',
      format: resolved.format,
    })
    return currentCache
  }

  const bookData = await loadBookBinary(bookKey)
  const payload = await primeBookCacheAfterImport(
    bookKey,
    toArrayBuffer(bookData.bookData),
    bookData.format,
    bookData.fileName
  )
  finishLog({
    bookKey,
    source: 'rebuilt-cache',
    format: bookData.format,
  })
  return payload
}

export const loadBookBinary = async (
  bookKey: string
): Promise<LoadedBookBinary> => {
  const finishLog = createDurationLogger('book-repository', 'load-book-binary', {
    bookKey,
  })
  const resolved = await resolveBookFile(bookKey)

  try {
    const localBookData = await readLocalBookFile(resolved.fileName)
    const payload = {
      ...resolved,
      bookData: localBookData,
    }
    finishLog({
      bookKey,
      source: 'local',
      bytes: localBookData.byteLength,
      fileName: resolved.fileName,
    })
    return payload
  } catch (localError) {
    logWarn('book-repository', 'load-book-binary fallback-to-cloud', {
      bookKey,
      fileName: resolved.fileName,
    })
    const cloudBookData = await readCloudBookFile(resolved.fileName)
    const payload = {
      ...resolved,
      bookData: cloudBookData,
    }
    finishLog({
      bookKey,
      source: 'cloud',
      bytes: cloudBookData.byteLength,
      fileName: resolved.fileName,
    })
    return payload
  }
}

export const getImportedBookName = async (
  fileName: string,
  fileBuffer: ArrayBuffer
): Promise<{ bookKey: string; name: string; format: BookFormat }> => {
  const finishLog = createDurationLogger('book-repository', 'get-imported-book-name', {
    fileName,
  })
  const format = detectBookFormatFromPath(fileName)
  if (!format) {
    throw new Error(`Unsupported file format: ${fileName}`)
  }

  const meta = format === 'epub' ? await parseEpubMeta(fileBuffer) : parseTxtMeta(fileName)

  const payload = {
    bookKey: buildBookName(meta.title, meta.author),
    name: buildBookTitle(meta.title),
    format,
  }
  finishLog({
    fileName,
    bookKey: payload.bookKey,
    bookTitle: payload.name,
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
