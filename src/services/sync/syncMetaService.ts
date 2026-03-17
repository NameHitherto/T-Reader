import { BookConfig } from '@/js/map'

const DEFAULT_SOURCE = 'treader-webdav'
const DEFAULT_DEVICE_ID = 'tauri-desktop'

export const attachSyncMeta = (bookConfig: BookConfig): BookConfig => {
  return {
    ...bookConfig,
    schemaVersion: 2,
    source: bookConfig.source || DEFAULT_SOURCE,
    deviceId: bookConfig.deviceId || DEFAULT_DEVICE_ID,
    updatedAt: new Date().toISOString(),
  }
}

export const buildInitialSyncMeta = () => ({
  schemaVersion: 2,
  source: DEFAULT_SOURCE,
  deviceId: DEFAULT_DEVICE_ID,
  updatedAt: new Date().toISOString(),
})
