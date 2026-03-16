import { invoke } from '@tauri-apps/api/core'
import { BaseDirectory, readFile, writeFile } from '@tauri-apps/plugin-fs'
import { BookConfig } from '@/js/map'
import { BookFormat, getBookFilename } from '@/js/bookFormat'
import { attachSyncMeta } from '@/services/sync/syncMetaService'
import {
  normalizeBookConfigFromLegado,
  toLegadoProgressPayload,
} from '@/services/sync/legadoMapper'

export const loadBookConfig = async (bookId: string): Promise<BookConfig> => {
  let bookConfigData: Uint8Array

  try {
    const cloudConfigData = await invoke('webdav_get', {
      filename: `${bookId}.json`,
    })
    bookConfigData = new Uint8Array(cloudConfigData as ArrayBufferLike)
  } catch (error) {
    bookConfigData = await readFile(`T-Reader/${bookId}.json`, {
      baseDir: BaseDirectory.Document,
    })
  }

  const parsedConfig: BookConfig = JSON.parse(new TextDecoder().decode(bookConfigData))
  return normalizeBookConfigFromLegado(parsedConfig)
}

export const saveBookConfig = async (bookId: string, config: BookConfig): Promise<void> => {
  const nextConfig = attachSyncMeta(config)
  const legadoProgress = toLegadoProgressPayload(nextConfig)
  nextConfig.legacySync = legadoProgress
  const jsonString = JSON.stringify(nextConfig)
  const jsonUint8Array = new TextEncoder().encode(jsonString)

  await invoke('save_file', {
    filename: `${bookId}.json`,
    contents: jsonString,
  })

  await invoke('webdav_upload', {
    filename: `${bookId}.json`,
    contents: Array.from(jsonUint8Array),
  })
}

export const loadBookBinary = async (
  bookId: string,
  format: BookFormat
): Promise<Uint8Array> => {
  const filename = getBookFilename(bookId, format)

  try {
    return await readFile(`T-Reader/${filename}`, {
      baseDir: BaseDirectory.Document,
    })
  } catch (error) {
    const cloudBookData = await invoke('webdav_get', {
      filename,
    })
    const localBookData = new Uint8Array(cloudBookData as ArrayBufferLike)

    await writeFile(`T-Reader/${filename}`, localBookData, {
      baseDir: BaseDirectory.Document,
    })

    return localBookData
  }
}
