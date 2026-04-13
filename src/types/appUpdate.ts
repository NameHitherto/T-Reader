export type AppUpdateStage = 'preparing' | 'downloading' | 'installing' | 'handoff' | 'failed'

export interface AppUpdateSource {
  id: string
  label: string
  kind: string
  endpoint: string | null
  enabled: boolean
}

export interface AppUpdateProxyInfo {
  source: string
  proxyMode: string
  proxyUrl: string | null
}

export interface AppUpdateAttempt {
  stage: string
  sourceId: string
  endpoint: string
  proxyMode: string
  durationMs: number
  success: boolean
  errorSummary: string | null
}

export interface AppUpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string | null
  releaseNotes: string | null
  publishedAt: string | null
  source: AppUpdateSource
  sources: AppUpdateSource[]
  proxy: AppUpdateProxyInfo
  attempts: AppUpdateAttempt[]
  checkedAt: number
  updateToken: string | null
  error: string | null
}

export interface AppUpdateProgressEvent {
  stage: AppUpdateStage
  downloadedBytes: number
  totalBytes: number | null
  percent: number | null
  speedBytesPerSec: number | null
  message: string
  sourceLabel: string
  errorSummary: string | null
  eventAt: number
}
