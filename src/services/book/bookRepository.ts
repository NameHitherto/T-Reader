import { invoke } from '@tauri-apps/api/core'
import { BookConfig } from '@/js/map'
import { BookFormat, getBookFilename } from '@/js/bookFormat'
import { attachSyncMeta } from '@/services/sync/syncMetaService'
import {
  normalizeBookConfigFromLegado,
  toLegadoProgressPayload,
} from '@/services/sync/legadoMapper'
import { getLocalDirNames } from '@/services/fileSystem/dirService'

const toUint8Array = (data: ArrayBufferLike | Uint8Array | number[]): Uint8Array => {
  if (data instanceof Uint8Array) {
    return data
  }

  if (Array.isArray(data)) {
    return Uint8Array.from(data)
  }

  return new Uint8Array(data)
}

/**
 * 加载书籍配置，默认优先读取本地文件，只有本地不存在时才回退到云端。
 */
export const loadBookConfig = async (bookId: string): Promise<BookConfig> => {
  const dirs = await getLocalDirNames()
  let bookConfigData: Uint8Array

  try {
    const localData = await invoke('read_file', {
      subdir: dirs.progress,
      filename: `${bookId}.json`,
    })
    bookConfigData = toUint8Array(localData as ArrayBufferLike | Uint8Array | number[])
  } catch (localError) {
    const cloudConfigData = await invoke('webdav_get_progress', {
      subdir: dirs.progress,
      filename: `${bookId}.json`,
    })
    bookConfigData = toUint8Array(cloudConfigData as ArrayBufferLike | Uint8Array | number[])
  }

  const parsedConfig: BookConfig = JSON.parse(new TextDecoder().decode(bookConfigData))
  return normalizeBookConfigFromLegado(parsedConfig)
}

/**
 * 保存书籍配置到本地，并异步同步到云端。
 */
export const saveBookConfig = async (bookId: string, config: BookConfig): Promise<void> => {
  const nextConfig = attachSyncMeta(config)
  const legadoProgress = toLegadoProgressPayload(nextConfig)
  nextConfig.legacySync = legadoProgress
  const jsonString = JSON.stringify(nextConfig)
  const jsonUint8Array = new TextEncoder().encode(jsonString)

  const dirs = await getLocalDirNames()

  await invoke('save_file', {
    subdir: dirs.progress,
    filename: `${bookId}.json`,
    contents: jsonString,
  })

  await invoke('webdav_upload_progress', {
    subdir: dirs.progress,
    filename: `${bookId}.json`,
    contents: Array.from(jsonUint8Array),
  })
}

/**
 * 加载书籍二进制内容，优先读取本地文件，失败后再从云端回退。
 */
export const loadBookBinary = async (
  bookId: string,
  format: BookFormat
): Promise<Uint8Array> => {
  const filename = getBookFilename(bookId, format)
  const dirs = await getLocalDirNames()

  try {
    const localData = await invoke('read_file', {
      subdir: dirs.books,
      filename,
    })
    return toUint8Array(localData as ArrayBufferLike | Uint8Array | number[])
  } catch (localError) {
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
}
