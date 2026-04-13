import { logWarn } from '@/utils/logger'
import {
  buildLocalFilePath,
  LOCAL_DIRS,
  readJsonFile,
  writeJsonFile,
} from '@/services/fileSystem/localStorageService'

export type AppThemeMode = 'light' | 'dark'

export interface AppSettings {
  webdavUrlRoot: string
  webdavUrlFolder: string
  webdavUrl: string
  webdavUser: string
  webdavPass: string
  isAiEnabled: string
  modelName: string
  modelUrl: string
  modelApiKey: string
  themeMode: AppThemeMode
}

export const normalizeAppThemeMode = (value: unknown): AppThemeMode => {
  return value === 'dark' ? 'dark' : 'light'
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  webdavUrlRoot: '',
  webdavUrlFolder: '',
  webdavUrl: '',
  webdavUser: '',
  webdavPass: '',
  isAiEnabled: 'false',
  modelName: '',
  modelUrl: '',
  modelApiKey: '',
  themeMode: 'light',
}

export const normalizeAppSettings = (
  settings: Partial<AppSettings> | null | undefined
): AppSettings => {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...(settings || {}),
    themeMode: normalizeAppThemeMode(settings?.themeMode),
  }
}

export const loadAppSettings = async (): Promise<AppSettings> => {
  try {
    const loadedSettings = await readJsonFile<Partial<AppSettings>>(
      buildLocalFilePath(LOCAL_DIRS.system, 'setting.json')
    )
    return normalizeAppSettings(loadedSettings)
  } catch (error) {
    logWarn('appSettings', '加载应用设置失败，已回退到默认设置', error)
    return { ...DEFAULT_APP_SETTINGS }
  }
}

export const saveAppSettings = async (settings: Partial<AppSettings>) => {
  const entries = Object.entries(settings).filter(([, value]) => value !== undefined)
  const payload = Object.fromEntries(entries) as Partial<AppSettings>

  if ('themeMode' in payload) {
    payload.themeMode = normalizeAppThemeMode(payload.themeMode)
  }

  let currentSettings: Record<string, unknown> = {}

  try {
    currentSettings = await readJsonFile<Record<string, unknown>>(
      buildLocalFilePath(LOCAL_DIRS.system, 'setting.json')
    )
  } catch (error) {
    currentSettings = {}
  }

  await writeJsonFile(
    buildLocalFilePath(LOCAL_DIRS.system, 'setting.json'),
    {
      ...currentSettings,
      ...payload,
    }
  )
}
