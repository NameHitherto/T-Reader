import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { WINDOW_EVENTS } from '@/constants/events'
import {
  loadAppSettings,
  normalizeAppThemeMode,
  type AppThemeMode,
} from '@/services/settings/appSettingsService'
import type {
  ReaderBackgroundPreset,
  ReaderBackgroundPresets,
  ReaderDarkBackgroundPreset,
  ReaderLightBackgroundPreset,
} from '@/types/readerBackground'
import { DEFAULT_READER_BACKGROUND_PRESETS } from '@/types/readerBackground'

const THEME_ATTRIBUTE = 'data-theme'

export interface AppThemePalette {
  appBackground: string
  appForeground: string
  loadingOverlay: string
  readerBackground: string
  readerSurface: string
  readerSurfaceStrong: string
  readerText: string
  readerMutedText: string
  readerLink: string
  readerSelectionBackground: string
  readerSelectionColor: string
  readerImageFilter: string
}

export interface ReaderRuntimePalette {
  viewportBackground: string
  contentBackground: string
  surface: string
  surfaceStrong: string
  text: string
  mutedText: string
  link: string
  selectionBackground: string
  selectionColor: string
  imageFilter: string
}

export interface ReaderBackgroundPresetOption<T extends ReaderBackgroundPreset> {
  value: T
  label: string
  description: string
  preview: string
}

const THEME_PALETTES: Record<AppThemeMode, AppThemePalette> = {
  light: {
    appBackground: '#FFFFFF',
    appForeground: '#111827',
    loadingOverlay: 'rgba(255, 255, 255, 0.84)',
    readerBackground: '#FFFFFF',
    readerSurface: '#F3F4F6',
    readerSurfaceStrong: '#FFFFFF',
    readerText: '#111827',
    readerMutedText: '#4B5563',
    readerLink: '#2563EB',
    readerSelectionBackground: 'rgba(37, 99, 235, 0.18)',
    readerSelectionColor: '#111827',
    readerImageFilter: 'none',
  },
  dark: {
    appBackground: '#121212',
    appForeground: '#E0E0E0',
    loadingOverlay: 'rgba(18, 18, 18, 0.84)',
    readerBackground: '#121212',
    readerSurface: '#1E1E1E',
    readerSurfaceStrong: '#252525',
    readerText: '#E0E0E0',
    readerMutedText: '#9E9E9E',
    readerLink: '#10B981',
    readerSelectionBackground: 'rgba(16, 185, 129, 0.22)',
    readerSelectionColor: '#E0E0E0',
    readerImageFilter: 'brightness(0.94) contrast(1.02)',
  },
}

const LIGHT_BACKGROUND_PRESET_VALUES = new Set<ReaderLightBackgroundPreset>([
  'default',
  'warm-yellow',
])

const DARK_BACKGROUND_PRESET_VALUES = new Set<ReaderDarkBackgroundPreset>([
  'default',
  'ide-dark',
])

const LIGHT_BACKGROUND_PRESET_OPTIONS: ReaderBackgroundPresetOption<ReaderLightBackgroundPreset>[] = [
  {
    value: 'default',
    label: '主题默认',
    description: '沿用白天主题的简约纯白底色。',
    preview: '#FFFFFF',
  },
  {
    value: 'warm-yellow',
    label: '暖黄护眼',
    description: '暖黄纸面配色，适合长时间沉浸阅读。',
    preview: '#FBF0D9',
  },
]

const DARK_BACKGROUND_PRESET_OPTIONS: ReaderBackgroundPresetOption<ReaderDarkBackgroundPreset>[] = [
  {
    value: 'default',
    label: '主题默认',
    description: '沿用黑夜主题的柔和深灰底色。',
    preview: '#121212',
  },
  {
    value: 'ide-dark',
    label: 'IDE 深色',
    description: 'VS Code 风格的深色阅读背景。',
    preview: '#1E1E1E',
  },
]

const READER_RUNTIME_OVERRIDES: Record<
  AppThemeMode,
  Partial<Record<ReaderBackgroundPreset, Partial<ReaderRuntimePalette>>>
> = {
  light: {
    default: {},
    'warm-yellow': {
      viewportBackground: '#FBF0D9',
      contentBackground: '#FBF0D9',
      surface: '#F4E5C2',
      surfaceStrong: '#FBF0D9',
      text: '#433422',
      mutedText: '#785D3D',
      link: '#B45309',
      selectionBackground: 'rgba(180, 83, 9, 0.18)',
      selectionColor: '#433422',
    },
  },
  dark: {
    default: {},
    'ide-dark': {
      viewportBackground: '#1E1E1E',
      contentBackground: '#1E1E1E',
      surface: '#252526',
      surfaceStrong: '#333333',
      text: '#D4D4D4',
      mutedText: '#CCCCCC',
      link: '#007ACC',
      selectionBackground: 'rgba(0, 122, 204, 0.24)',
      selectionColor: '#D4D4D4',
      imageFilter: 'brightness(0.94) contrast(1.02)',
    },
  },
}

const normalizeLightBackgroundPreset = (value: unknown): ReaderLightBackgroundPreset => {
  return typeof value === 'string' && LIGHT_BACKGROUND_PRESET_VALUES.has(value as ReaderLightBackgroundPreset)
    ? (value as ReaderLightBackgroundPreset)
    : DEFAULT_READER_BACKGROUND_PRESETS.light
}

const normalizeDarkBackgroundPreset = (value: unknown): ReaderDarkBackgroundPreset => {
  return typeof value === 'string' && DARK_BACKGROUND_PRESET_VALUES.has(value as ReaderDarkBackgroundPreset)
    ? (value as ReaderDarkBackgroundPreset)
    : DEFAULT_READER_BACKGROUND_PRESETS.dark
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

export const normalizeReaderBackgroundPresets = (
  presets: Partial<ReaderBackgroundPresets> | null | undefined
): ReaderBackgroundPresets => {
  return {
    light: normalizeLightBackgroundPreset(presets?.light),
    dark: normalizeDarkBackgroundPreset(presets?.dark),
  }
}

const resolveReaderBackgroundPresets = (
  configOrPresets?:
    | { backgroundPresets?: Partial<ReaderBackgroundPresets> | null }
    | Partial<ReaderBackgroundPresets>
    | null
) => {
  if (
    configOrPresets &&
    typeof configOrPresets === 'object' &&
    'backgroundPresets' in configOrPresets
  ) {
    return normalizeReaderBackgroundPresets(configOrPresets.backgroundPresets)
  }

  return normalizeReaderBackgroundPresets(configOrPresets as Partial<ReaderBackgroundPresets> | null | undefined)
}

export const getReaderBackgroundPresetOptions = (
  mode: AppThemeMode = getAppliedAppThemeMode()
) => {
  return normalizeAppThemeMode(mode) === 'dark'
    ? DARK_BACKGROUND_PRESET_OPTIONS
    : LIGHT_BACKGROUND_PRESET_OPTIONS
}

export const getActiveReaderBackgroundPreset = (
  configOrPresets?:
    | { backgroundPresets?: Partial<ReaderBackgroundPresets> | null }
    | Partial<ReaderBackgroundPresets>
    | null,
  mode: AppThemeMode = getAppliedAppThemeMode()
) => {
  const normalizedMode = normalizeAppThemeMode(mode)
  return resolveReaderBackgroundPresets(configOrPresets)[normalizedMode]
}

export const getReaderRuntimePalette = (
  configOrPresets?:
    | { backgroundPresets?: Partial<ReaderBackgroundPresets> | null }
    | Partial<ReaderBackgroundPresets>
    | null,
  mode: AppThemeMode = getAppliedAppThemeMode()
): ReaderRuntimePalette => {
  const normalizedMode = normalizeAppThemeMode(mode)
  const basePalette = getAppThemePalette(normalizedMode)
  const activePreset = getActiveReaderBackgroundPreset(configOrPresets, normalizedMode)

  const defaultPalette: ReaderRuntimePalette = {
    viewportBackground: basePalette.readerBackground,
    contentBackground: basePalette.readerBackground,
    surface: basePalette.readerSurface,
    surfaceStrong: basePalette.readerSurfaceStrong,
    text: basePalette.readerText,
    mutedText: basePalette.readerMutedText,
    link: basePalette.readerLink,
    selectionBackground: basePalette.readerSelectionBackground,
    selectionColor: basePalette.readerSelectionColor,
    imageFilter: basePalette.readerImageFilter,
  }

  return {
    ...defaultPalette,
    ...(READER_RUNTIME_OVERRIDES[normalizedMode][activePreset] || {}),
  }
}

export const getReaderThemeCompatColors = (
  configOrPresets?:
    | { backgroundPresets?: Partial<ReaderBackgroundPresets> | null }
    | Partial<ReaderBackgroundPresets>
    | null,
  mode: AppThemeMode = getAppliedAppThemeMode()
) => {
  const palette = getReaderRuntimePalette(configOrPresets, mode)
  return {
    color: palette.contentBackground,
    fontColor: palette.text,
  }
}

export const syncReaderConfigThemeColors = <
  T extends {
    color: string
    fontColor: string
    backgroundPresets?: Partial<ReaderBackgroundPresets>
  },
>(
  config: T,
  mode: AppThemeMode = getAppliedAppThemeMode()
): T => {
  return {
    ...config,
    ...getReaderThemeCompatColors(config, mode),
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
