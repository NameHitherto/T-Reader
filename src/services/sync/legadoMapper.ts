import { BookConfig } from '@/js/map'

export interface LegadoProgressPayload {
  bookId: string
  progress: number
  location: string
  updatedAt: string
  source: string
  deviceId: string
}

const DEFAULT_SOURCE = 'treader-webdav'
const DEFAULT_DEVICE_ID = 'tauri-desktop'
const getDefaultLocation = (bookConfig: Partial<BookConfig>) => {
  if (bookConfig.locationFormat === 'paragraph' || bookConfig.format === 'txt') {
    return '0'
  }

  return ''
}

const toTime = (value?: string) => {
  if (!value) {
    return 0
  }
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? 0 : ts
}

export const toLegadoProgressPayload = (bookConfig: BookConfig): LegadoProgressPayload => {
  return {
    bookId: bookConfig.id,
    progress: bookConfig.progress || 0,
    location: bookConfig.location ?? getDefaultLocation(bookConfig),
    updatedAt: bookConfig.updatedAt || new Date().toISOString(),
    source: bookConfig.source || DEFAULT_SOURCE,
    deviceId: bookConfig.deviceId || DEFAULT_DEVICE_ID,
  }
}

export const applyLegadoPayloadToBookConfig = (
  bookConfig: BookConfig,
  payload: LegadoProgressPayload
): BookConfig => {
  return {
    ...bookConfig,
    progress: payload.progress,
    location: payload.location,
    updatedAt: payload.updatedAt,
    source: payload.source,
    deviceId: payload.deviceId,
    legacySync: payload,
  }
}

export const normalizeBookConfigFromLegado = (bookConfig: BookConfig): BookConfig => {
  const legacySync = bookConfig.legacySync
  if (!legacySync) {
    return bookConfig
  }

  const localTime = toTime(bookConfig.updatedAt)
  const legacyTime = toTime(legacySync.updatedAt)

  const shouldUseLegacy =
    legacyTime > localTime ||
    bookConfig.progress === undefined ||
    !bookConfig.location

  const mergedPayload: LegadoProgressPayload = {
    bookId: legacySync.bookId || bookConfig.id,
    progress: legacySync.progress ?? bookConfig.progress ?? 0,
    location: legacySync.location || bookConfig.location || getDefaultLocation(bookConfig),
    updatedAt: legacySync.updatedAt || bookConfig.updatedAt || new Date().toISOString(),
    source: legacySync.source || bookConfig.source || DEFAULT_SOURCE,
    deviceId: legacySync.deviceId || bookConfig.deviceId || DEFAULT_DEVICE_ID,
  }

  if (!shouldUseLegacy) {
    return {
      ...bookConfig,
      legacySync: toLegadoProgressPayload(bookConfig),
    }
  }

  return applyLegadoPayloadToBookConfig(bookConfig, mergedPayload)
}
