import { invoke } from '@tauri-apps/api/core'
import { BookConfig } from '@/types/book'
import {
  detectBookFormatFromFilename,
  detectBookFormatFromPath,
} from '@/services/book/bookFormatService'
import type {
  StoredBookRecord,
  UpdateBookMetadataRequest,
  UpdateBookMetadataResult,
  UpsertBookRequest,
} from '@/services/book/bookRepositoryTypes'
import { buildBookConfigFromImport } from '@/services/book/bookImportService'
import { buildBookName, buildBookTitle, toBookConfigFilename } from '@/services/book/bookIdentity'
import { normalizeBookConfig } from '@/services/book/bookConfigService'
import { logError, logInfo, logWarn } from '@/utils/logger'
import { encodeJson } from '@/utils/json'
import { BookFormat } from '@/types/book'
import { dispatchMainEvent } from '@/services/ipc'
import { WINDOW_EVENTS } from '@/constants/events'
import { loadAppSettings } from '@/services/settings/appSettingsService'
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
  record: StoredBookRecord
}

let cachedBookFileMap: Map<string, ResolvedBookFile> | null = null

const toPersistedBookConfig = (config: BookConfig): BookConfig => {
  return normalizeBookConfig({
    ...config,
    durChapterTime: typeof config.durChapterTime === 'number' ? config.durChapterTime : Date.now(),
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

const toStoredBookConfig = async (book: StoredBookRecord): Promise<StoredBookConfig> => {
  let progressConfig: BookConfig | null = null

  try {
    progressConfig = await loadBookConfig(book.bookKey)
  } catch (error) {
    logWarn('book-repository', 'load-book-configs missing-progress-config', {
      bookKey: book.bookKey,
      error,
    })
  }

  return {
    bookKey: book.bookKey,
    record: book,
    config: normalizeBookConfig({
      ...progressConfig,
      name: progressConfig?.name || book.title,
      author: progressConfig?.author || book.author,
    }),
  }
}

export const upsertStoredBook = async (request: UpsertBookRequest): Promise<StoredBookRecord> => {
  const record = await invoke<StoredBookRecord>('upsert_book', { request })
  cachedBookFileMap = null

  return record
}

export const getStoredBookByKey = async (bookKey: string): Promise<StoredBookRecord | null> => {
  return await invoke<StoredBookRecord | null>('get_book_by_key', { bookKey })
}

export const updateBookMetadata = async (
  request: UpdateBookMetadataRequest,
): Promise<UpdateBookMetadataResult> => {
  const result = await invoke<UpdateBookMetadataResult>('update_book_metadata', { request })
  cachedBookFileMap = null
  return result
}

export const updateBookProgress = async (
  bookKey: string,
  progress: number,
): Promise<StoredBookRecord> => {
  return await invoke<StoredBookRecord>('update_book_progress', {
    bookKey,
    progress,
  })
}

export const updateBookCover = async (
  bookKey: string,
  hasCover: boolean,
  coverName?: string | null,
): Promise<StoredBookRecord> => {
  return await invoke<StoredBookRecord>('update_book_cover', {
    bookKey,
    hasCover,
    coverName: hasCover ? coverName || null : null,
  })
}

const persistBookConfigToLocal = async (filename: string, config: BookConfig): Promise<void> => {
  await writeJsonFile(
    buildLocalFilePath(LOCAL_DIRS.progress, filename),
    toPersistedBookConfig(config),
  )
}

const persistBookConfigToCloud = async (filename: string, config: BookConfig): Promise<void> => {
  await invoke('webdav_upload', {
    subdir: CLOUD_DIRS.progress,
    filename,
    contents: Array.from(encodeJson(toPersistedBookConfig(config))),
  })
}

const readLocalBookConfig = async (filename: string): Promise<BookConfig> => {
  const data = await readJsonFile<Partial<BookConfig> & Record<string, unknown>>(
    buildLocalFilePath(LOCAL_DIRS.progress, filename),
  )

  return normalizeBookConfig(data)
}

const readCloudBookConfig = async (filename: string): Promise<BookConfig> => {
  const data = await invoke('webdav_get', {
    subdir: CLOUD_DIRS.progress,
    filename,
  })

  return parseBookConfigData(toUint8Array(data as ArrayBufferLike | Uint8Array | number[]))
}

const CLOUD_BOOK_CONFIG_READ_TIMEOUT_MS = 1500

type CloudBookConfigReadAvailability = 'available' | 'offline' | 'unconfigured'

let webdavConfigAvailabilityPromise: Promise<boolean> | null = null

const isValidWebdavUrl = (value: string): boolean => {
  try {
    const url = new URL(value)

    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const hasValidWebdavConfig = async (): Promise<boolean> => {
  if (!webdavConfigAvailabilityPromise) {
    webdavConfigAvailabilityPromise = loadAppSettings()
      .then((settings) => isValidWebdavUrl(settings.webdavUrl.trim()))
      .finally(() => {
        webdavConfigAvailabilityPromise = null
      })
  }

  return await webdavConfigAvailabilityPromise
}

const getCloudBookConfigReadAvailability = async (): Promise<CloudBookConfigReadAvailability> => {
  if (navigator.onLine === false) {
    return 'offline'
  }

  return (await hasValidWebdavConfig()) ? 'available' : 'unconfigured'
}

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}

const readLocalBookFile = async (filename: string): Promise<Uint8Array> => {
  const payload = await readLocalBookFileFromDisk(filename)
  logInfo('book-repository', 'read-local-book-file:done', {
    fileName: filename,
    bytes: payload.byteLength,
  })
  return payload
}

const readCloudBookFile = async (filename: string): Promise<Uint8Array> => {
  const cloudBookData = await invoke('webdav_get', {
    subdir: CLOUD_DIRS.books,
    filename,
  })
  const localBookData = toUint8Array(cloudBookData as ArrayBufferLike | Uint8Array | number[])

  await writeLocalBookFile(filename, localBookData)

  const persistedLocalBookData = await readLocalBookFileFromDisk(filename)

  logInfo('book-repository', 'read-cloud-book-file:done', {
    fileName: filename,
    bytes: persistedLocalBookData.byteLength,
  })
  return persistedLocalBookData
}

const loadStoredBookFileMap = async (): Promise<Map<string, ResolvedBookFile>> => {
  if (cachedBookFileMap) {
    return cachedBookFileMap
  }

  const storedBooks = await invoke<StoredBookRecord[]>('list_books')
  const fileMap = new Map<string, ResolvedBookFile>()

  for (const book of storedBooks) {
    const resolved = toResolvedBookFile(book.fileName)
    if (!resolved) {
      continue
    }

    fileMap.set(book.bookKey, resolved)
  }

  cachedBookFileMap = fileMap
  return fileMap
}

export const invalidateBookFileCache = () => {
  cachedBookFileMap = null
}

export const hasLocalBookFile = async (fileName: string): Promise<boolean> => {
  return await localBookExists(fileName)
}

export const loadBookConfigs = async (): Promise<StoredBookConfig[]> => {
  const storedBooks = await invoke<StoredBookRecord[]>('list_books')
  const normalizedConfigs = await Promise.all(storedBooks.map(toStoredBookConfig))
  logInfo('book-repository', 'load-book-configs:done', {
    total: normalizedConfigs.length,
  })
  return normalizedConfigs
}

export const loadBookConfig = async (bookKey: string): Promise<BookConfig> => {
  const filename = toBookConfigFilename(bookKey)
  const cloudAvailability = await getCloudBookConfigReadAvailability()
  let cloudError: unknown

  if (cloudAvailability === 'available') {
    try {
      const cloudConfig = await withTimeout(
        readCloudBookConfig(filename),
        CLOUD_BOOK_CONFIG_READ_TIMEOUT_MS,
        `Timed out reading cloud book config: ${bookKey}`,
      )

      try {
        await persistBookConfigToLocal(filename, cloudConfig)
      } catch (localPersistError) {
        logWarn('book-repository', 'load-book-config cache-cloud-locally-failed', {
          bookKey,
          fileName: filename,
          error: localPersistError,
        })
      }

      logInfo('book-repository', 'load-book-config:done', {
        bookKey,
        source: 'cloud',
        durChapterTime: getDurChapterTime(cloudConfig),
      })
      return cloudConfig
    } catch (error) {
      cloudError = error
      logWarn('book-repository', 'load-book-config fallback-to-local', {
        bookKey,
        fileName: filename,
        error,
      })
    }
  } else {
    logInfo('book-repository', 'load-book-config skip-cloud', {
      bookKey,
      fileName: filename,
      reason: cloudAvailability,
    })
  }

  try {
    const localConfig = await readLocalBookConfig(filename)
    logInfo('book-repository', 'load-book-config:done', {
      bookKey,
      source: 'local',
      durChapterTime: getDurChapterTime(localConfig),
    })
    return localConfig
  } catch (localError) {
    logWarn('book-repository', 'load-book-config unavailable', {
      bookKey,
      fileName: filename,
      cloudAvailability,
      cloudError,
      localError,
    })
    throw Object.assign(new Error(`Book config not found for ${bookKey}`), {
      cause: cloudError ?? localError,
    })
  }
}

const notifyBookConfigCloudSyncFailed = (bookKey: string, filename: string): void => {
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

interface PendingBookConfigCloudSave {
  filename: string
  config: BookConfig
}

const pendingBookConfigCloudSaves = new Map<string, PendingBookConfigCloudSave>()
const processingBookConfigCloudSaves = new Set<string>()

const processBookConfigCloudSaves = async (bookKey: string): Promise<void> => {
  if (processingBookConfigCloudSaves.has(bookKey)) {
    return
  }

  processingBookConfigCloudSaves.add(bookKey)
  try {
    let pending = pendingBookConfigCloudSaves.get(bookKey)
    while (pending) {
      pendingBookConfigCloudSaves.delete(bookKey)
      try {
        await persistBookConfigToCloud(pending.filename, pending.config)
        logInfo('book-repository', 'save-book-config cloud-sync-done', {
          bookKey,
          fileName: pending.filename,
        })
      } catch (error) {
        logWarn('book-repository', 'save-book-config cloud-sync-failed', {
          bookKey,
          fileName: pending.filename,
          error,
        })
        notifyBookConfigCloudSyncFailed(bookKey, pending.filename)
      }

      pending = pendingBookConfigCloudSaves.get(bookKey)
    }
  } finally {
    processingBookConfigCloudSaves.delete(bookKey)
  }
}

const queueBookConfigCloudSave = (bookKey: string, filename: string, config: BookConfig): void => {
  pendingBookConfigCloudSaves.set(bookKey, { filename, config })
  queueMicrotask(() => {
    void processBookConfigCloudSaves(bookKey)
  })
}

export const saveBookConfig = async (bookKey: string, config: BookConfig): Promise<void> => {
  const filename = toBookConfigFilename(bookKey)
  const persisted = toPersistedBookConfig(config)
  const jsonBytes = encodeJson(persisted)

  await persistBookConfigToLocal(filename, persisted)
  queueBookConfigCloudSave(bookKey, filename, persisted)

  logInfo('book-repository', 'save-book-config:done', {
    bookKey,
    bytes: jsonBytes.byteLength,
  })
}

export const resolveBookFile = async (bookKey: string): Promise<ResolvedBookFile> => {
  const storedResolved = await invoke<ResolvedBookFile | null>('resolve_book_file', {
    bookKey,
  })

  if (!storedResolved) {
    logError('book-repository', 'resolve-book-file missing', undefined, {
      bookKey,
    })
    throw new Error('未能定位到对应书籍文件。')
  }

  const currentFileMap = await loadStoredBookFileMap()
  currentFileMap.set(bookKey, storedResolved)
  cachedBookFileMap = currentFileMap
  logInfo('book-repository', 'resolve-book-file:done', {
    bookKey,
    source: 'database',
    fileName: storedResolved.fileName,
    format: storedResolved.format,
  })
  return storedResolved
}

export const resolveBookFormat = async (bookKey: string): Promise<BookFormat> => {
  const resolved = await resolveBookFile(bookKey)

  return resolved.format
}

export const loadLocalBookBinary = async (bookKey: string): Promise<LoadedBookBinary | null> => {
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
  const resolved = await resolveBookFile(bookKey)

  try {
    const localBookData = await readLocalBookFile(resolved.fileName)
    logInfo('book-repository', 'load-book-binary:done', {
      bookKey,
      source: 'local',
      bytes: localBookData.byteLength,
      fileName: resolved.fileName,
    })
    return {
      ...resolved,
      bookData: localBookData,
    }
  } catch {
    logWarn('book-repository', 'load-book-binary fallback-to-cloud', {
      bookKey,
      fileName: resolved.fileName,
    })
    const cloudBookData = await readCloudBookFile(resolved.fileName)
    logInfo('book-repository', 'load-book-binary:done', {
      bookKey,
      source: 'cloud',
      bytes: cloudBookData.byteLength,
      fileName: resolved.fileName,
    })
    return {
      ...resolved,
      bookData: cloudBookData,
    }
  }
}

export const downloadBookFileToLocal = async (bookKey: string): Promise<LoadedBookBinary> => {
  const resolved = await resolveBookFile(bookKey)
  const bookData = await readCloudBookFile(resolved.fileName)
  const currentFileMap = await loadStoredBookFileMap()
  currentFileMap.set(bookKey, resolved)
  cachedBookFileMap = currentFileMap

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

export const removeStoredBook = async (bookKey: string): Promise<void> => {
  await invoke('remove_book_by_key', { bookKey })
  cachedBookFileMap?.delete(bookKey)
}

export const getImportedBookName = async (
  fileName: string,
  fileBuffer: ArrayBuffer,
): Promise<{ bookKey: string; name: string; format: BookFormat }> => {
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
  logInfo('book-repository', 'get-imported-book-name:done', {
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
