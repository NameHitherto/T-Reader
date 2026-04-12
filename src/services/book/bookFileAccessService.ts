import { BaseDirectory } from '@tauri-apps/api/path'
import { exists, readFile } from '@tauri-apps/plugin-fs'

const DOCUMENT_BOOK_ROOT = 'T-Reader/books'

export const getLocalBookRelativePath = (fileName: string): string => {
  return `${DOCUMENT_BOOK_ROOT}/${fileName}`
}

export const localBookExists = async (fileName: string): Promise<boolean> => {
  return await exists(getLocalBookRelativePath(fileName), {
    baseDir: BaseDirectory.Document,
  })
}

export const readLocalBookFile = async (fileName: string): Promise<Uint8Array> => {
  const payload = await readFile(getLocalBookRelativePath(fileName), {
    baseDir: BaseDirectory.Document,
  })

  return payload instanceof Uint8Array ? payload : new Uint8Array(payload)
}
