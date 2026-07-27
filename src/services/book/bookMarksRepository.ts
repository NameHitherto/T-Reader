import { invoke } from '@tauri-apps/api/core'
import { BookMark } from '@/store/bookMark'

export const loadAllBookMarks = async (): Promise<BookMark[]> => {
  return await invoke<BookMark[]>('load_all_notes')
}

export const loadBookMarksByBookKey = async (bookKey: string): Promise<BookMark[]> => {
  return await invoke<BookMark[]>('load_notes_by_book_key', { bookKey })
}

export const saveAllBookMarks = async (bookMarks: BookMark[]): Promise<void> => {
  await invoke('save_all_notes', { notes: bookMarks })
}

export const replaceBookMarksForBook = async (
  bookKey: string,
  nextMarks: BookMark[],
): Promise<void> => {
  await invoke('replace_notes_for_book', { bookKey, notes: nextMarks })
}

export const removeBookMarksByBookKey = async (bookKey: string): Promise<void> => {
  await invoke('remove_notes_by_book_key', { bookKey })
}
