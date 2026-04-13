import {
  buildLocalFilePath,
  LOCAL_DIRS,
  readJsonFile,
  writeJsonFile,
} from '@/services/fileSystem/localStorageService'

export interface BookFileIndexEntry {
  bookKey: string
  fileName: string
}

export interface BookFileIndexFile {
  updatedAt: string
  entries: BookFileIndexEntry[]
}

const BOOK_FILE_INDEX_FILENAME = 'BookFileIndex.json'

let cachedBookFileIndex: BookFileIndexFile | null = null

const normalizeFileName = (fileName: string): string => fileName.trim()

const buildPayload = (entries: BookFileIndexEntry[]): BookFileIndexFile => ({
  updatedAt: new Date().toISOString(),
  entries,
})

const readIndexFile = async (): Promise<BookFileIndexFile | null> => {
  if (cachedBookFileIndex) {
    return cachedBookFileIndex
  }

  try {
    const payload = await readJsonFile<Partial<BookFileIndexFile>>(
      buildLocalFilePath(LOCAL_DIRS.system, BOOK_FILE_INDEX_FILENAME)
    )

    const normalizedEntries = Array.isArray(payload.entries)
      ? payload.entries
          .filter(
            (entry): entry is BookFileIndexEntry =>
              typeof entry?.bookKey === 'string' && typeof entry?.fileName === 'string'
          )
          .map((entry) => ({
            bookKey: entry.bookKey,
            fileName: normalizeFileName(entry.fileName),
          }))
          .filter((entry) => entry.bookKey && entry.fileName)
      : []

    cachedBookFileIndex = {
      updatedAt:
        typeof payload.updatedAt === 'string' ? payload.updatedAt : new Date().toISOString(),
      entries: normalizedEntries,
    }

    return cachedBookFileIndex
  } catch (error) {
    return null
  }
}

export const invalidateBookFileIndexStore = () => {
  cachedBookFileIndex = null
}

export const loadBookFileIndex = async (): Promise<BookFileIndexFile | null> => {
  return readIndexFile()
}

export const saveBookFileIndex = async (payload: BookFileIndexFile): Promise<void> => {
  const normalizedPayload = buildPayload(payload.entries)

  await writeJsonFile(buildLocalFilePath(LOCAL_DIRS.system, BOOK_FILE_INDEX_FILENAME), normalizedPayload)

  cachedBookFileIndex = normalizedPayload
}

export const getFilenameByBookKey = async (bookKey: string): Promise<string | null> => {
  const payload = await readIndexFile()
  if (!payload) {
    return null
  }

  return payload.entries.find((entry) => entry.bookKey === bookKey)?.fileName || null
}

export const getBookKeyByFilename = async (fileName: string): Promise<string | null> => {
  const payload = await readIndexFile()
  if (!payload) {
    return null
  }

  const normalizedFileName = normalizeFileName(fileName)
  return payload.entries.find((entry) => entry.fileName === normalizedFileName)?.bookKey || null
}

export const setBookFileIndexEntry = async (bookKey: string, fileName: string): Promise<void> => {
  const payload = (await readIndexFile()) || buildPayload([])
  const normalizedFileName = normalizeFileName(fileName)
  const nextEntries = payload.entries.filter(
    (entry) => entry.bookKey !== bookKey && entry.fileName !== normalizedFileName
  )

  nextEntries.push({
    bookKey,
    fileName: normalizedFileName,
  })

  await saveBookFileIndex(buildPayload(nextEntries))
}

export const removeBookFileIndexEntryByBookKey = async (bookKey: string): Promise<void> => {
  const payload = await readIndexFile()
  if (!payload) {
    return
  }

  const nextEntries = payload.entries.filter((entry) => entry.bookKey !== bookKey)
  if (nextEntries.length === payload.entries.length) {
    return
  }

  await saveBookFileIndex(buildPayload(nextEntries))
}
