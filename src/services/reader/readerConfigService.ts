import {
  buildLocalFilePath,
  LOCAL_DIRS,
  readJsonFile,
  writeJsonFile,
} from '@/services/fileSystem/localStorageService'

const READER_CONFIG_FILENAME = 'ReaderConfig.json'

export const loadReaderConfigFromDisk = async () => {
  return await readJsonFile<Record<string, unknown>>(
    buildLocalFilePath(LOCAL_DIRS.system, READER_CONFIG_FILENAME)
  )
}

export const saveReaderConfigToDisk = async (config: object) => {
  await writeJsonFile(buildLocalFilePath(LOCAL_DIRS.system, READER_CONFIG_FILENAME), config)
}
