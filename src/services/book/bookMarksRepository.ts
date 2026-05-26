import { BookMark } from '@/store/bookMark'
import {
  buildLocalFilePath,
  LOCAL_DIRS,
  readJsonFile,
  writeJsonFile,
} from '@/services/fileSystem/localStorageService'

export interface BookMarksFile {
  updatedAt: string
  bookMarks: BookMark[]
}

const BOOK_MARKS_FILENAME = 'BookMarks.json'

const buildPayload = (bookMarks: BookMark[]): BookMarksFile => ({
  updatedAt: new Date().toISOString(),
  bookMarks,
})

const readBookMarksFile = async (): Promise<BookMarksFile | null> => {
  try {
    return await readJsonFile<BookMarksFile>(
      buildLocalFilePath(LOCAL_DIRS.system, BOOK_MARKS_FILENAME),
    )
  } catch {
    return null
  }
}

export const loadAllBookMarks = async (): Promise<BookMark[]> => {
  const payload = await readBookMarksFile()

  return Array.isArray(payload?.bookMarks) ? payload.bookMarks : []
}

export const loadBookMarksByBookKey = async (bookKey: string): Promise<BookMark[]> => {
  const bookMarks = await loadAllBookMarks()

  return bookMarks.filter((bookMark) => bookMark.bookName === bookKey)
}

export const saveAllBookMarks = async (bookMarks: BookMark[]): Promise<void> => {
  const payload = buildPayload(bookMarks)

  await writeJsonFile(buildLocalFilePath(LOCAL_DIRS.system, BOOK_MARKS_FILENAME), payload)
}

export const replaceBookMarksForBook = async (
  bookKey: string,
  nextMarks: BookMark[],
): Promise<void> => {
  const payload = await readBookMarksFile()
  if (!payload && nextMarks.length === 0) {
    return
  }

  const bookMarks = payload?.bookMarks || []
  const remainingMarks = bookMarks.filter((bookMark) => bookMark.bookName !== bookKey)
  await saveAllBookMarks(remainingMarks.concat(nextMarks))
}

export const removeBookMarksByBookKey = async (bookKey: string): Promise<void> => {
  const payload = await readBookMarksFile()
  if (!payload) {
    return
  }

  const bookMarks = payload.bookMarks
  await saveAllBookMarks(bookMarks.filter((bookMark) => bookMark.bookName !== bookKey))
}
