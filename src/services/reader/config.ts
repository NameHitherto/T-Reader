import { invoke } from '@tauri-apps/api/core'

export const loadReaderConfigFromDisk = async () => {
  return await invoke<Record<string, unknown>>('load_reader_config')
}

export const saveReaderConfigToDisk = async (config: object) => {
  await invoke('save_reader_config', { request: config })
}
