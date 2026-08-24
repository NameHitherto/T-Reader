import { invoke } from '@tauri-apps/api/core'
import { logWarn } from '@/utils/logger'
import { MODEL_PURPOSES } from '@/services/settings/modelTypes'
import type { ModelProvider, ModelProviderMap, ModelPurpose } from '@/services/settings/modelTypes'
import type { UpdateChannel } from '@/services/settings/updateTypes'
import type { AppSettings, AppThemeMode } from './types'

export type { AppSettings, AppThemeMode } from './types'

export const normalizeAppThemeMode = (value: unknown): AppThemeMode => {
  return value === 'dark' ? 'dark' : 'light'
}

export const normalizeUpdateChannel = (value: unknown): UpdateChannel => {
  return value === 'preview' ? 'preview' : 'stable'
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
  webdavTimeoutSeconds: 30,
  modelProviders: emptyModelProviders(),
  themeMode: 'light',
  updateChannel: 'stable',
  proxyEnabled: false,
}

export const normalizeWebdavTimeoutSeconds = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_APP_SETTINGS.webdavTimeoutSeconds
  }
  return Math.min(300, Math.max(1, Math.round(value)))
}

export const normalizeAppSettings = (
  settings: Partial<AppSettings> | null | undefined,
): AppSettings => {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...(settings || {}),
    themeMode: normalizeAppThemeMode(settings?.themeMode),
    updateChannel: normalizeUpdateChannel(settings?.updateChannel),
    proxyEnabled: settings?.proxyEnabled === true,
    webdavTimeoutSeconds: normalizeWebdavTimeoutSeconds(settings?.webdavTimeoutSeconds),
    modelProviders: normalizeModelProviders(settings?.modelProviders),
  }
}

export const loadAppSettings = async (): Promise<AppSettings> => {
  try {
    const loadedSettings = await invoke<Partial<AppSettings>>('load_app_settings')

    return normalizeAppSettings(loadedSettings)
  } catch (error) {
    logWarn('app-settings', 'load-failed fallback-to-default', error)
    return { ...DEFAULT_APP_SETTINGS }
  }
}

export const saveAppSettings = async (settings: Partial<AppSettings>) => {
  const entries = Object.entries(settings).filter(([, value]) => value !== undefined)
  const payload: Record<string, unknown> = Object.fromEntries(entries)

  if ('themeMode' in payload) {
    payload.themeMode = normalizeAppThemeMode(payload.themeMode)
  }

  if ('updateChannel' in payload) {
    payload.updateChannel = normalizeUpdateChannel(payload.updateChannel)
  }

  if ('modelProviders' in payload) {
    payload.modelProviders = compactModelProviders(normalizeModelProviders(payload.modelProviders))
  }

  await invoke<AppSettings>('save_app_settings', { request: payload })
}
