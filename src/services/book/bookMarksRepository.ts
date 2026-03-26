import { invoke } from '@tauri-apps/api/core'
import { getLocalDirNames } from '@/services/fileSystem/dirService'
import { BookMark } from '@/store/bookMark'
import { encodeJson } from '@/utils/json'

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
  const dirs = await getLocalDirNames()
  let fileData: ArrayBufferLike | number[] | Uint8Array

  try {
    fileData = await invoke('read_file', {
      subdir: dirs.system,
      filename: BOOK_MARKS_FILENAME,
    })
  } catch (error) {
    return null
  }

  return JSON.parse(
    new TextDecoder().decode(new Uint8Array(fileData as ArrayBufferLike))
  ) as BookMarksFile
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
  const dirs = await getLocalDirNames()
  const payload = buildPayload(bookMarks)

  await invoke('write_file', {
    subdir: dirs.system,
    filename: BOOK_MARKS_FILENAME,
    contents: Array.from(encodeJson(payload)),
  })
}

export const replaceBookMarksForBook = async (
  bookKey: string,
  nextMarks: BookMark[]
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
