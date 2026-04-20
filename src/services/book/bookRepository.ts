import { invoke } from '@tauri-apps/api/core'
import { BookConfig } from '@/types/book'
import {
  detectBookFormatFromFilename,
  detectBookFormatFromPath,
} from '@/services/book/bookFormatService'
import {
  BookCachePayload,
  hasRequiredBookCache,
  loadBookCache,
  primeBookCacheAfterImport,
} from '@/services/book/bookCacheService'
import {
  BookFileIndexEntry,
  getFilenameByBookKey,
  loadBookFileIndex,
  removeBookFileIndexEntryByBookKey,
  saveBookFileIndex,
  setBookFileIndexEntry,
} from '@/services/book/bookFileIndexRepository'
import { buildBookConfigFromImport } from '@/services/book/bookImportService'
import {
  buildBookName,
  buildBookTitle,
  getBookKeyFromConfigFilename,
  toBookConfigFilename,
} from '@/services/book/bookIdentity'
import { normalizeBookConfig } from '@/services/book/bookConfigService'
import {
  createDurationLogger,
  logError,
  logWarn,
} from '@/utils/logger'
import { encodeJson } from '@/utils/json'
import { BookFormat } from '@/types/book'
import { dispatchMainEvent } from '@/services/reader/readerWindowBridgeService'
import { WINDOW_EVENTS } from '@/constants/events'
import {
  localBookExists,
  listLocalBookFiles,
  readLocalBookFile as readLocalBookFileFromDisk,
  writeLocalBookFile,
} from '@/services/book/bookFileAccessService'
import {
  buildLocalFilePath,
  CLOUD_DIRS,
  LOCAL_DIRS,
  readJsonFile,
  readLocalDirEntries,
  writeJsonFile,
} from '@/services/fileSystem/localStorageService'

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

const toResolvedBookFile = (fileName: string): ResolvedBookFile | null => {
  const format = detectBookFormatFromFilename(fileName)
  if (!format) {
    return null
  }

  return {
    fileName,
    format,
  }
}

const persistBookConfigToLocal = async (filename: string, config: BookConfig): Promise<void> => {
  await writeJsonFile(
    buildLocalFilePath(LOCAL_DIRS.progress, filename),
    toPersistedBookConfig(config)
  )
}

const persistBookConfigToCloud = async (filename: string, config: BookConfig): Promise<void> => {
  await invoke('webdav_upload', {
    subdir: CLOUD_DIRS.progress,
    filename,
    contents: Array.from(encodeJson(toPersistedBookConfig(config))),
  })
}

const readLocalBookFile = async (filename: string): Promise<Uint8Array> => {
  const finishLog = createDurationLogger('book-repository', 'read-local-book-file', {
    fileName: filename,
  })
  const payload = await readLocalBookFileFromDisk(filename)
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
  const cloudBookData = await invoke('webdav_get', {
    subdir: CLOUD_DIRS.books,
    filename,
  })
  const localBookData = toUint8Array(cloudBookData as ArrayBufferLike | Uint8Array | number[])

  await writeLocalBookFile(filename, localBookData)

  const persistedLocalBookData = await readLocalBookFileFromDisk(filename)

  finishLog({
    fileName: filename,
    bytes: persistedLocalBookData.byteLength,
  })
  return persistedLocalBookData
}

const loadStoredBookIndexMap = async (): Promise<Map<string, ResolvedBookFile>> => {
  if (cachedBookFileIndex) {
    return cachedBookFileIndex
  }

  const payload = await loadBookFileIndex()
  const indexMap = new Map<string, ResolvedBookFile>()

  for (const entry of payload?.entries || []) {
    const resolved = toResolvedBookFile(entry.fileName)
    if (!resolved) {
      continue
    }

    indexMap.set(entry.bookKey, resolved)
  }

  cachedBookFileIndex = indexMap
  return indexMap
}

const persistRecoveredIndexEntries = async (entries: BookFileIndexEntry[]) => {
  if (entries.length === 0) {
    return
  }

  const currentPayload = (await loadBookFileIndex()) || {
    updatedAt: new Date().toISOString(),
    entries: [],
  }

  const nextEntries = [...currentPayload.entries]
  for (const entry of entries) {
    const duplicateIndex = nextEntries.findIndex(
      (current) => current.bookKey === entry.bookKey || current.fileName === entry.fileName
    )

    if (duplicateIndex >= 0) {
      nextEntries.splice(duplicateIndex, 1)
    }

    nextEntries.push(entry)
  }

  await saveBookFileIndex({
    updatedAt: new Date().toISOString(),
    entries: nextEntries,
  })
}

export const invalidateBookFileIndex = () => {
  cachedBookFileIndex = null
}

export const reconcileLibraryBookFileIndex = async (
  targetBookKeys: string[] = []
): Promise<Map<string, ResolvedBookFile>> => {
  const finishLog = createDurationLogger('book-repository', 'reconcile-library-book-file-index', {
    targetBookKeys,
  })
  const currentIndex = await loadStoredBookIndexMap()
  const targetSet = new Set(targetBookKeys.filter((bookKey) => !currentIndex.has(bookKey)))
  const localFiles = await listLocalBookFiles()
  const indexedFileNames = new Set(
    Array.from(currentIndex.values()).map((entry) => entry.fileName.toLowerCase())
  )
  const unresolvedFiles = localFiles.filter((fileName) => !indexedFileNames.has(fileName.toLowerCase()))

  if (targetBookKeys.length > 0 && targetSet.size === 0) {
    finishLog({
      recovered: 0,
      sourceFiles: unresolvedFiles.length,
    })
    return currentIndex
  }

  const recoveredEntries: BookFileIndexEntry[] = []

  for (const fileName of unresolvedFiles) {
    const format = detectBookFormatFromFilename(fileName)
    if (!format) {
      continue
    }

    const bookData = await readLocalBookFile(fileName)
    const fileBuffer = toArrayBuffer(bookData)
    const meta = await buildBookConfigFromImport({
      sourcePath: fileName,
      originalFileName: fileName,
      format,
      fileBuffer,
    })
    const bookKey = buildBookName(meta.name, meta.author)

    if (!currentIndex.has(bookKey)) {
      const resolved = {
        fileName,
        format,
      }
      currentIndex.set(bookKey, resolved)
      recoveredEntries.push({
        bookKey,
        fileName,
      })
    }

    targetSet.delete(bookKey)
    if (targetBookKeys.length > 0 && targetSet.size === 0) {
      break
    }
  }

  await persistRecoveredIndexEntries(recoveredEntries)
  cachedBookFileIndex = currentIndex
  finishLog({
    recovered: recoveredEntries.length,
    sourceFiles: unresolvedFiles.length,
  })
  return currentIndex
}

export const hasLocalBookFile = async (fileName: string): Promise<boolean> => {
  return await localBookExists(fileName)
}

export const loadBookConfigs = async (): Promise<StoredBookConfig[]> => {
  const finishLog = createDurationLogger('book-repository', 'load-book-configs')
  const entries = await readLocalDirEntries(`T-Reader/${LOCAL_DIRS.progress}`)
  const configEntries = entries.filter(
    (entry) => entry.isFile && entry.name.toLowerCase().endsWith('.json')
  )
  const normalizedConfigs = (
    await Promise.all(
      configEntries.map(async (entry) => {
        try {
          const payload = await readJsonFile<Partial<BookConfig> & Record<string, unknown>>(
            buildLocalFilePath(LOCAL_DIRS.progress, entry.name)
          )

          return {
            bookKey: getBookKeyFromConfigFilename(entry.name),
            config: normalizeBookConfig(payload),
          }
        } catch (error) {
          logWarn('book-repository', 'load-book-configs skip-invalid-config', {
            fileName: entry.name,
            error,
          })
          return null
        }
      })
    )
  ).filter((entry): entry is StoredBookConfig => entry !== null)
  finishLog({
    total: normalizedConfigs.length,
  })
  return normalizedConfigs
}

export const loadBookConfig = async (bookKey: string): Promise<BookConfig> => {
  const finishLog = createDurationLogger('book-repository', 'load-book-config', {
    bookKey,
  })
  const filename = toBookConfigFilename(bookKey)
  const [localResult, cloudResult] = await Promise.allSettled([
    readJsonFile<Partial<BookConfig> & Record<string, unknown>>(
      buildLocalFilePath(LOCAL_DIRS.progress, filename)
    ).then((data) => normalizeBookConfig(data)),
    invoke('webdav_get', {
      subdir: CLOUD_DIRS.progress,
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

export const saveBookConfig = async (bookKey: string, config: BookConfig): Promise<void> => {
  const finishLog = createDurationLogger('book-repository', 'save-book-config', {
    bookKey,
  })
  const filename = toBookConfigFilename(bookKey)
  const persisted = toPersistedBookConfig(config)
  const jsonBytes = encodeJson(persisted)

  await persistBookConfigToLocal(filename, persisted)

  try {
    await persistBookConfigToCloud(filename, persisted)
  } catch (error) {
    logWarn('book-repository', 'save-book-config cloud-sync-failed', {
      bookKey,
      fileName: filename,
      error,
    })
    void dispatchMainEvent(WINDOW_EVENTS.CLOUD_SYNC_FAILED, {
      bookKey,
      fileName: filename,
    }).catch((dispatchError) => {
      logWarn('book-repository', 'dispatch-cloud-sync-failed-event failed', {
        bookKey,
        error: dispatchError,
      })
    })
  }

  finishLog({
    bookKey,
    bytes: jsonBytes.byteLength,
  })
}

export const resolveBookFile = async (bookKey: string): Promise<ResolvedBookFile> => {
  const finishLog = createDurationLogger('book-repository', 'resolve-book-file', {
    bookKey,
  })
  const storedFileName = await getFilenameByBookKey(bookKey)
  const storedResolved = storedFileName ? toResolvedBookFile(storedFileName) : null

  if (storedResolved) {
    const currentIndex = await loadStoredBookIndexMap()
    currentIndex.set(bookKey, storedResolved)
    cachedBookFileIndex = currentIndex
    finishLog({
      bookKey,
      source: 'global-index',
      fileName: storedResolved.fileName,
      format: storedResolved.format,
    })
    return storedResolved
  }

  const reconciledIndex = await reconcileLibraryBookFileIndex([bookKey])
  const recovered = reconciledIndex.get(bookKey)
  if (!recovered) {
    logError('book-repository', 'resolve-book-file missing', undefined, {
      bookKey,
    })
    throw new Error('未能定位到对应书籍文件。')
  }

  finishLog({
    bookKey,
    source: 'targeted-recovery',
    fileName: recovered.fileName,
    format: recovered.format,
  })
  return recovered
}

export const resolveBookFormat = async (bookKey: string): Promise<BookFormat> => {
  const resolved = await resolveBookFile(bookKey)
  return resolved.format
}

export const ensureBookCache = async (bookKey: string): Promise<BookCachePayload> => {
  const finishLog = createDurationLogger('book-repository', 'ensure-book-cache', {
    bookKey,
  })
  const currentCache = (await loadBookCache(bookKey)) || {}
  const resolved = await resolveBookFile(bookKey)
  const hasRequiredCache = hasRequiredBookCache(currentCache)

  if (hasRequiredCache) {
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
    bookData.fileName
  )
  finishLog({
    bookKey,
    source: 'rebuilt-cache',
    format: bookData.format,
  })
  return payload
}

export const loadLocalBookBinary = async (
  bookKey: string
): Promise<LoadedBookBinary | null> => {
  const resolved = await resolveBookFile(bookKey)
  const exists = await hasLocalBookFile(resolved.fileName)
  if (!exists) {
    return null
  }

  return {
    ...resolved,
    bookData: await readLocalBookFile(resolved.fileName),
  }
}

export const loadBookBinary = async (bookKey: string): Promise<LoadedBookBinary> => {
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

export const downloadBookFileToLocal = async (bookKey: string): Promise<LoadedBookBinary> => {
  const resolved = await resolveBookFile(bookKey)
  const bookData = await readCloudBookFile(resolved.fileName)
  await setBookFileIndexEntry(bookKey, resolved.fileName)
  const currentIndex = await loadStoredBookIndexMap()
  currentIndex.set(bookKey, resolved)
  cachedBookFileIndex = currentIndex

  return {
    ...resolved,
    bookData,
  }
}

export const uploadLocalBookFileToCloud = async (bookKey: string): Promise<ResolvedBookFile> => {
  const resolved = await resolveBookFile(bookKey)
  const bookData = await readLocalBookFile(resolved.fileName)

  await invoke('webdav_upload', {
    subdir: CLOUD_DIRS.books,
    filename: resolved.fileName,
    contents: Array.from(bookData),
  })

  return resolved
}

export const removeBookFileIndexEntry = async (bookKey: string): Promise<void> => {
  await removeBookFileIndexEntryByBookKey(bookKey)
  cachedBookFileIndex?.delete(bookKey)
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

  const meta = await buildBookConfigFromImport({
    sourcePath: fileName,
    originalFileName: fileName,
    format,
    fileBuffer,
  })

  const payload = {
    bookKey: buildBookName(meta.name, meta.author),
    name: buildBookTitle(meta.name),
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
