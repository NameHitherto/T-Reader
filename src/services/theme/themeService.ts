import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { WINDOW_EVENTS } from '@/constants/events'
import {
  loadAppSettings,
  normalizeAppThemeMode,
  type AppThemeMode,
} from '@/services/settings/appSettingsService'

const THEME_ATTRIBUTE = 'data-theme'

export interface AppThemePalette {
  appBackground: string
  appForeground: string
  loadingOverlay: string
  readerBackground: string
  readerText: string
  readerMutedText: string
  readerLink: string
  readerSelectionBackground: string
  readerSelectionColor: string
  readerImageFilter: string
}

const THEME_PALETTES: Record<AppThemeMode, AppThemePalette> = {
  light: {
    appBackground: '#eef3fb',
    appForeground: '#0f172a',
    loadingOverlay: 'rgba(238, 243, 251, 0.82)',
    readerBackground: '#f7f9fc',
    readerText: '#162033',
    readerMutedText: '#526079',
    readerLink: '#2563eb',
    readerSelectionBackground: 'rgba(37, 99, 235, 0.18)',
    readerSelectionColor: '#0f172a',
    readerImageFilter: 'none',
  },
  dark: {
    appBackground: '#08111f',
    appForeground: '#e2e8f0',
    loadingOverlay: 'rgba(2, 6, 23, 0.72)',
    readerBackground: '#0f172a',
    readerText: '#e2e8f0',
    readerMutedText: '#94a3b8',
    readerLink: '#93c5fd',
    readerSelectionBackground: 'rgba(96, 165, 250, 0.26)',
    readerSelectionColor: '#f8fafc',
    readerImageFilter: 'brightness(0.92) contrast(1.02)',
  },
}

export const getAppliedAppThemeMode = (): AppThemeMode => {
  if (typeof document === 'undefined') {
    return 'light'
  }
  return normalizeAppThemeMode(document.documentElement.getAttribute(THEME_ATTRIBUTE))
}

export const getAppThemePalette = (
  mode: AppThemeMode = getAppliedAppThemeMode()
): AppThemePalette => {
  return THEME_PALETTES[normalizeAppThemeMode(mode)]
}

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

export const getReaderThemeCompatColors = (
  mode: AppThemeMode = getAppliedAppThemeMode()
) => {
  const palette = getAppThemePalette(mode)
  return {
    color: palette.readerBackground,
    fontColor: palette.readerText,
  }
}

export const syncReaderConfigThemeColors = <
  T extends {
    color: string
    fontColor: string
  },
>(
  config: T,
  mode: AppThemeMode = getAppliedAppThemeMode()
): T => {
  return {
    ...config,
    ...getReaderThemeCompatColors(mode),
  }
}

export const emitAppThemeUpdate = async (mode: AppThemeMode) => {
  const normalizedMode = applyAppThemeMode(mode)
  const currentWindow = getCurrentWebviewWindow()
  const readerWindow = await WebviewWindow.getByLabel('reader')

  await Promise.allSettled([
    currentWindow.emit(WINDOW_EVENTS.UPDATE_APP_THEME, { mode: normalizedMode }),
    ...(readerWindow
      ? [readerWindow.emit(WINDOW_EVENTS.UPDATE_APP_THEME, { mode: normalizedMode })]
      : []),
  ])

  return normalizedMode
}
