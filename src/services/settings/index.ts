export {
  DEFAULT_APP_SETTINGS,
  loadAppSettings,
  normalizeAppSettings,
  normalizeAppThemeMode,
  normalizeUpdateChannel,
  normalizeWebdavTimeoutSeconds,
  saveAppSettings,
} from './appSettings'
export { detectSystemProxy } from './proxy'

export type { AppSettings, AppThemeMode } from './types'
export { ENDPOINT_PRESETS, MODEL_PURPOSES, PROVIDER_TYPES, PURPOSE_LABELS } from './modelTypes'
export type { ModelProvider, ModelProviderMap, ModelPurpose, ProviderType } from './modelTypes'
export type {
  AppUpdateAttempt,
  AppUpdateCheckResult,
  AppUpdateProgressEvent,
  AppUpdateProxyInfo,
  AppUpdateSource,
  AppUpdateStage,
  UpdateChannel,
} from './updateTypes'
export type { SystemProxyInfo } from './proxyTypes'
