import { invoke } from '@tauri-apps/api/core'
import { getLocalDirNames } from '@/services/fileSystem/dirService'

export const loadReaderConfigFromDisk = async () => {
  const dirs = await getLocalDirNames()
  const configData = await invoke('read_file', {
    subdir: dirs.system,
    filename: 'ReaderConfig.json',
  })
  return JSON.parse(new TextDecoder().decode(new Uint8Array(configData as ArrayBufferLike)))
}

export const saveReaderConfigToDisk = async (config: Record<string, any>) => {
  const dirs = await getLocalDirNames()
  const jsonStr = JSON.stringify(config)
  await invoke('write_file', {
    subdir: dirs.system,
    filename: 'ReaderConfig.json',
    contents: Array.from(new TextEncoder().encode(jsonStr)),
  })
}
