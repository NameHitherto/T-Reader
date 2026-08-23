import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { WINDOW_EVENTS } from '@/constants/events'
import { dispatchReaderThemeUpdate } from '@/services/ipc'
import { loadAppSettings, normalizeAppThemeMode, type AppThemeMode } from '@/services/settings'

const THEME_ATTRIBUTE = 'data-theme'

export const applyAppThemeMode = (mode: unknown): AppThemeMode => {
  const normalizedMode = normalizeAppThemeMode(mode)
  document.documentElement.setAttribute(THEME_ATTRIBUTE, normalizedMode)
  document.documentElement.style.colorScheme = normalizedMode
  return normalizedMode
}

export const initializeAppTheme = async () => {
  const settings = await loadAppSettings()

  return applyAppThemeMode(settings.themeMode)
}

export const emitAppThemeUpdate = async (mode: AppThemeMode) => {
  const normalizedMode = applyAppThemeMode(mode)
  const currentWindow = getCurrentWebviewWindow()

  await Promise.allSettled([
    currentWindow.emit(WINDOW_EVENTS.UPDATE_APP_THEME, { mode: normalizedMode }),
    dispatchReaderThemeUpdate(normalizedMode),
  ])

  return normalizedMode
}
