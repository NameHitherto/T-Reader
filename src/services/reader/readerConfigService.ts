import { BaseDirectory, readFile, writeFile } from '@tauri-apps/plugin-fs'
import { getLocalDirNames } from '@/services/fileSystem/dirService'

export const loadReaderConfigFromDisk = async () => {
  const dirs = await getLocalDirNames()
  const configData = await readFile(`${dirs.system}/ReaderConfig.json`, {
    baseDir: BaseDirectory.Document,
  })
  return JSON.parse(new TextDecoder().decode(configData))
}

export const saveReaderConfigToDisk = async (config: Record<string, any>) => {
  const dirs = await getLocalDirNames()
  const jsonStr = JSON.stringify(config)
  await writeFile(`${dirs.system}/ReaderConfig.json`, new TextEncoder().encode(jsonStr), {
    baseDir: BaseDirectory.Document,
  })
}
