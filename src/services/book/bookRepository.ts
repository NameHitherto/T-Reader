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
  const dirs = await getLocalDirNames()
  const localData = await invoke('read_file', {
    subdir: dirs.books,
    filename,
  })
  return toUint8Array(localData as ArrayBufferLike | Uint8Array | number[])
}

const readCloudBookFile = async (filename: string): Promise<Uint8Array> => {
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
}

export const loadBookConfigs = async (): Promise<BookConfig[]> => {
  const dirs = await getLocalDirNames()
  return invoke('load_books', { subdir: dirs.progress })
}

export const loadBookConfig = async (bookId: string): Promise<BookConfig> => {
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
  }

  return JSON.parse(new TextDecoder().decode(bookConfigData)) as BookConfig
}

export const loadBookCacheByConfig = async (
  bookConfig: Pick<BookConfig, 'title' | 'author'>
) => {
  return loadBookCache(bookConfig)
}

export const saveBookConfig = async (bookId: string, config: BookConfig): Promise<void> => {
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
}

export const resolveBookFile = async (
  bookConfig: Pick<BookConfig, 'id' | 'title' | 'author'>
): Promise<ResolvedBookFile> => {
  const cachedResolved = await getBookFileFromCache(bookConfig)
  if (cachedResolved) {
    return cachedResolved
  }

  if (!cachedBookFileIndex) {
    await rebuildBookFileIndex()
  }

  const indexed = cachedBookFileIndex?.get(bookConfig.id)
  if (indexed) {
    await persistResolvedBookFile(bookConfig, indexed)
    return indexed
  }

  const rebuiltIndex = await rebuildBookFileIndex()
  const rebuilt = rebuiltIndex.get(bookConfig.id)
  if (!rebuilt) {
    throw new Error(`Book file not found for ${bookConfig.id}`)
  }

  await persistResolvedBookFile(bookConfig, rebuilt)
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
  const currentCache = (await loadBookCache(bookConfig)) || {}
  const resolved = await resolveBookFile(bookConfig)
  const hasRequiredCache =
    resolved.format === 'epub'
      ? Boolean(currentCache.bookFileName && currentCache.locations)
      : Boolean(currentCache.bookFileName && currentCache.paragraphCount)

  if (hasRequiredCache && (resolved.format !== 'epub' || currentCache.cover !== undefined)) {
    return currentCache
  }

  const bookData = await loadBookBinary(bookConfig)
  return primeBookCacheAfterImport(
    bookConfig,
    toArrayBuffer(bookData.bookData),
    bookData.format,
    bookData.fileName
  )
}

export const loadBookBinary = async (
  bookConfig: Pick<BookConfig, 'id' | 'title' | 'author'>
): Promise<LoadedBookBinary> => {
  const resolved = await resolveBookFile(bookConfig)

  try {
    const localBookData = await readLocalBookFile(resolved.fileName)
    return {
      ...resolved,
      bookData: localBookData,
    }
  } catch (localError) {
    const cloudBookData = await readCloudBookFile(resolved.fileName)
    return {
      ...resolved,
      bookData: cloudBookData,
    }
  }
}

export const getImportedBookIdentity = async (
  fileName: string,
  fileBuffer: ArrayBuffer
): Promise<{ id: string; format: BookFormat }> => {
  const format = detectBookFormatFromPath(fileName)
  if (!format) {
    throw new Error(`Unsupported file format: ${fileName}`)
  }

  const meta = format === 'epub' ? await parseEpubMeta(fileBuffer) : parseTxtMeta(fileName)

  return {
    id: buildBookIdentity(meta.title, meta.author),
    format,
  }
}

export const hasOriginalFilenameConflict = async (fileName: string): Promise<boolean> => {
  const filenames = await listLocalBookFiles()
  return filenames.includes(fileName)
}
