import { invoke } from '@tauri-apps/api/core'
import { BaseDirectory, readFile } from '@tauri-apps/plugin-fs'

export const loadReaderConfigFromDisk = async () => {
  const configData = await readFile('T-Reader/ReaderConfig.json', {
    baseDir: BaseDirectory.Document,
  })
  return JSON.parse(new TextDecoder().decode(configData))
}

export const saveReaderConfigToDisk = async (config: Record<string, any>) => {
  await invoke('save_file', {
    filename: 'ReaderConfig.json',
    contents: JSON.stringify(config),
  })
}
