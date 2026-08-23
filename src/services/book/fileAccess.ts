import { detectBookFormatFromPath } from '@/services/book/format'
import {
  buildLocalDirPath,
  buildLocalFilePath,
  LOCAL_DIRS,
  localPathExists,
  readBinaryFile,
  readLocalDirEntries,
  removeLocalFile,
  writeBinaryFile,
} from '@/services/fileSystem'

export const getLocalBookRelativePath = (fileName: string): string => {
  return buildLocalFilePath(LOCAL_DIRS.books, fileName)
}

export const localBookExists = async (fileName: string): Promise<boolean> => {
  return await localPathExists(getLocalBookRelativePath(fileName))
}

export const readLocalBookFile = async (fileName: string): Promise<Uint8Array> => {
  return await readBinaryFile(getLocalBookRelativePath(fileName))
}

export const writeLocalBookFile = async (
  fileName: string,
  contents: Uint8Array | number[],
): Promise<void> => {
  await writeBinaryFile(getLocalBookRelativePath(fileName), contents)
}

export const removeLocalBookFile = async (fileName: string): Promise<void> => {
  await removeLocalFile(getLocalBookRelativePath(fileName))
}

export const listLocalBookFiles = async (): Promise<string[]> => {
  const entries = await readLocalDirEntries(buildLocalDirPath(LOCAL_DIRS.books))

  return entries
    .filter((entry) => entry.isFile && detectBookFormatFromPath(entry.name))
    .map((entry) => entry.name)
}
