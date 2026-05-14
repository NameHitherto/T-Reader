import { logWarn } from '@/utils/logger'
import {
  buildLocalFilePath,
  LOCAL_DIRS,
  readJsonFile,
  writeJsonFile,
} from '@/services/fileSystem/localStorageService'
import type { ModelProvider, ModelProviderMap } from '@/types/model'

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

export const DEFAULT_APP_SETTINGS: AppSettings = {
  webdavUrlRoot: '',
  webdavUrlFolder: '',
  webdavUrl: '',
  webdavUser: '',
  webdavPass: '',
  modelProviders: emptyModelProviders(),
  themeMode: 'light',
}

const KNOWN_ENDPOINTS = ['/v1/chat/completions', '/v1/responses', '/v1/responses/compact', '/v1/messages']

function migrateLegacyAiSettings(raw: Record<string, unknown>): ModelProviderMap {
  const providers = emptyModelProviders()
  const isAiEnabled = raw.isAiEnabled === 'true'
  const modelName = typeof raw.modelName === 'string' ? raw.modelName : ''
  const modelUrl = typeof raw.modelUrl === 'string' ? raw.modelUrl : ''
  const modelApiKey = typeof raw.modelApiKey === 'string' ? raw.modelApiKey : ''

  if (!isAiEnabled || !modelName) {
    return providers
  }

  let baseUrl = modelUrl
  let endpoint = ''
  for (const ep of KNOWN_ENDPOINTS) {
    if (modelUrl.endsWith(ep)) {
      baseUrl = modelUrl.slice(0, -ep.length)
      endpoint = ep
      break
    }
  }

  providers.chat = {
    purpose: 'chat',
    providerType: 'Other',
    baseUrl,
    endpoint,
    modelId: modelName,
    apiKey: modelApiKey,
  }

  return providers
}

function hasLegacyAiFields(raw: Record<string, unknown>): boolean {
  return (
    'isAiEnabled' in raw ||
    'modelName' in raw ||
    'modelUrl' in raw ||
    'modelApiKey' in raw
  )
}

export const normalizeAppSettings = (
  settings: Partial<AppSettings> | null | undefined,
): AppSettings => {
  const merged = {
    ...DEFAULT_APP_SETTINGS,
    ...(settings || {}),
    themeMode: normalizeAppThemeMode(settings?.themeMode),
  }

  if (!merged.modelProviders || Object.keys(merged.modelProviders).length === 0) {
    const raw = (settings || {}) as Record<string, unknown>
    if (hasLegacyAiFields(raw)) {
      merged.modelProviders = migrateLegacyAiSettings(raw)
    } else {
      merged.modelProviders = emptyModelProviders()
    }
  }

  return merged
}

export const getChatProvider = (settings: AppSettings): ModelProvider | null => {
  return settings.modelProviders.chat ?? null
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
  const payload = Object.fromEntries(entries) as Partial<AppSettings>

  if ('themeMode' in payload) {
    payload.themeMode = normalizeAppThemeMode(payload.themeMode)
  }

  let currentSettings: Record<string, unknown> = {}

  try {
    currentSettings = await readJsonFile<Record<string, unknown>>(
      buildLocalFilePath(LOCAL_DIRS.system, 'setting.json'),
    )
  } catch {
    // Use defaults when the settings file has not been created yet.
  }

  await writeJsonFile(buildLocalFilePath(LOCAL_DIRS.system, 'setting.json'), {
    ...currentSettings,
    ...payload,
  })
}
