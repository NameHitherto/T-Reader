import { logWarn } from '@/utils/logger'
import {
  buildLocalFilePath,
  LOCAL_DIRS,
  readJsonFile,
  writeJsonFile,
} from '@/services/fileSystem/localStorageService'
import { MODEL_PURPOSES } from '@/types/model'
import type { ModelProvider, ModelProviderMap, ModelPurpose } from '@/types/model'

export type AppThemeMode = 'light' | 'dark'

export interface AppSettings {
  webdavUrlRoot: string
  webdavUrlFolder: string
  webdavUrl: string
  webdavUser: string
  webdavPass: string
  modelProviders: ModelProviderMap
  themeMode: AppThemeMode
}

export const normalizeAppThemeMode = (value: unknown): AppThemeMode => {
  return value === 'dark' ? 'dark' : 'light'
}

const emptyModelProviders = (): ModelProviderMap => ({
  chat: null,
  image: null,
  embedding: null,
  rerank: null,
})

const normalizeModelProviders = (value: unknown): ModelProviderMap => {
  const providers = emptyModelProviders()
  if (!value || typeof value !== 'object') {
    return providers
  }

  const rawProviders = value as Partial<Record<ModelPurpose, ModelProvider | null>>
  for (const purpose of MODEL_PURPOSES) {
    providers[purpose] = rawProviders[purpose] ?? null
  }

  return providers
}

const compactModelProviders = (providers: ModelProviderMap) => {
  return Object.fromEntries(
    Object.entries(providers).filter(([, provider]) => provider !== null),
  ) as Partial<Record<ModelPurpose, ModelProvider>>
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  webdavUrlRoot: '',
  webdavUrlFolder: '',
  webdavUrl: '',
  webdavUser: '',
  webdavPass: '',
  modelProviders: emptyModelProviders(),
  themeMode: 'light',
}

export const normalizeAppSettings = (
  settings: Partial<AppSettings> | null | undefined,
): AppSettings => {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...(settings || {}),
    themeMode: normalizeAppThemeMode(settings?.themeMode),
    modelProviders: normalizeModelProviders(settings?.modelProviders),
  }
}

export const loadAppSettings = async (): Promise<AppSettings> => {
  try {
    const loadedSettings = await readJsonFile<Partial<AppSettings>>(
      buildLocalFilePath(LOCAL_DIRS.system, 'setting.json'),
    )

    return normalizeAppSettings(loadedSettings)
  } catch (error) {
    logWarn('appSettings', '加载应用设置失败，已回退到默认设置', error)
    return { ...DEFAULT_APP_SETTINGS }
  }
}

export const saveAppSettings = async (settings: Partial<AppSettings>) => {
  const entries = Object.entries(settings).filter(([, value]) => value !== undefined)
  const payload: Record<string, unknown> = Object.fromEntries(entries)

  if ('themeMode' in payload) {
    payload.themeMode = normalizeAppThemeMode(payload.themeMode)
  }

  if ('modelProviders' in payload) {
    payload.modelProviders = compactModelProviders(normalizeModelProviders(payload.modelProviders))
  }

  let currentSettings: Record<string, unknown> = {}

  try {
    currentSettings = await readJsonFile<Record<string, unknown>>(
      buildLocalFilePath(LOCAL_DIRS.system, 'setting.json'),
    )
  } catch {
    // Use defaults when the settings file has not been created yet.
  }

  const nextSettings = {
    ...currentSettings,
    ...payload,
  }

  if ('modelProviders' in nextSettings) {
    nextSettings.modelProviders = compactModelProviders(
      normalizeModelProviders(nextSettings.modelProviders),
    )
  }

  await writeJsonFile(buildLocalFilePath(LOCAL_DIRS.system, 'setting.json'), nextSettings)
}
