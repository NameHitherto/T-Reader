import { invoke } from '@tauri-apps/api/core'
import { BaseDirectory, readFile, writeFile} from '@tauri-apps/plugin-fs'
import { BookConfig } from '@/js/map'
import { BookFormat, getBookFilename } from '@/js/bookFormat'
import { attachSyncMeta } from '@/services/sync/syncMetaService'
import {
  normalizeBookConfigFromLegado,
  toLegadoProgressPayload,
} from '@/services/sync/legadoMapper'
import { getLocalDirNames } from '@/services/fileSystem/dirService'

/**
 * 从云端 bookProgress 目录加载书籍配置
 */
export const loadBookConfig = async (bookId: string): Promise<BookConfig> => {
  let bookConfigData: Uint8Array

  try {
    const cloudConfigData = await invoke('webdav_get_progress', {
      filename: `${bookId}.json`,
    })
    bookConfigData = new Uint8Array(cloudConfigData as ArrayBufferLike)
  } catch (error) {
    const dirs = await getLocalDirNames()
    bookConfigData = await readFile(`${dirs.progress}/${bookId}.json`, {
      baseDir: BaseDirectory.Document,
    })
  }

  const parsedConfig: BookConfig = JSON.parse(new TextDecoder().decode(bookConfigData))
  return normalizeBookConfigFromLegado(parsedConfig)
}

/**
 * 保存书籍配置到本地 bookProgress 和云端 bookProgress
 */
export const saveBookConfig = async (bookId: string, config: BookConfig): Promise<void> => {
  const nextConfig = attachSyncMeta(config)
  const legadoProgress = toLegadoProgressPayload(nextConfig)
  nextConfig.legacySync = legadoProgress
  const jsonString = JSON.stringify(nextConfig)
  const jsonUint8Array = new TextEncoder().encode(jsonString)

  const dirs = await getLocalDirNames()

  // 保存到本地 bookProgress 目录
  await invoke('save_file', {
    filename: `${dirs.progress}/${bookId}.json`,
    contents: jsonString,
  })

  // 上传到云端 bookProgress 目录
  await invoke('webdav_upload_progress', {
    filename: `${bookId}.json`,
    contents: Array.from(jsonUint8Array),
  })
}

/**
 * 从本地 books 目录或云端加载书籍二进制文件
 */
export const loadBookBinary = async (
  bookId: string,
  format: BookFormat
): Promise<Uint8Array> => {
  const filename = getBookFilename(bookId, format)
  const dirs = await getLocalDirNames()

  try {
    return await readFile(`${dirs.books}/${filename}`, {
      baseDir: BaseDirectory.Document,
    })
  } catch (error) {
    const cloudBookData = await invoke('webdav_get', {
      filename,
    })
    const localBookData = new Uint8Array(cloudBookData as ArrayBufferLike)

    await writeFile(`${dirs.books}/${filename}`, localBookData, {
      baseDir: BaseDirectory.Document,
    })

    return localBookData
  }
}
