import { normalizeAppThemeMode, type AppThemeMode } from '@/services/settings'
import type {
  ReaderBackgroundPreset,
  ReaderBackgroundPresets,
  ReaderDarkBackgroundPreset,
  ReaderLightBackgroundPreset,
} from '@/services/theme/backgroundTypes'
import { DEFAULT_READER_BACKGROUND_PRESETS } from '@/services/theme/backgroundTypes'
import type { AppThemePalette, ReaderBackgroundPresetOption, ReaderRuntimePalette } from './types'

export type { AppThemePalette, ReaderBackgroundPresetOption, ReaderRuntimePalette } from './types'

const THEME_ATTRIBUTE = 'data-theme'

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
  'parchment',
  'kraft',
  'xuan',
  'warm-amber',
  'eye-green',
  'soft-cyan',
  'jade-white',
])

const DARK_BACKGROUND_PRESET_VALUES = new Set<ReaderDarkBackgroundPreset>([
  'default',
  'dark-night',
  'pure-black',
])

const LIGHT_BACKGROUND_PRESET_OPTIONS: ReaderBackgroundPresetOption<ReaderLightBackgroundPreset>[] =
  [
    {
      value: 'default',
      label: '主题默认',
      description: '沿用白天主题的简约纯白底色。',
      preview: '#FFFFFF',
    },
    {
      value: 'parchment',
      label: '羊皮纸纹',
      description: '拟真羊皮纸纹理，暖黄复古，适合文学与历史类书籍。',
      preview: '#F4EBD0',
      previewBackgroundImage:
        'radial-gradient(hsla(40, 30%, 80%, 0.5), hsla(38, 25%, 70%, 0.6)), repeating-radial-gradient(transparent 0, transparent 2px, rgba(139, 90, 43, 0.03) 3px, transparent 4px)',
    },
    {
      value: 'kraft',
      label: '牛皮纸',
      description: '复古牛皮纸颗粒质感，适合笔记与手账风格阅读。',
      preview: '#D9BE9B',
      previewBackgroundImage:
        'radial-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 0), radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 0)',
      previewBackgroundSize: '8px 8px, 12px 12px',
      previewBackgroundPosition: '0 0, 4px 4px',
    },
    {
      value: 'xuan',
      label: '棉麻宣纸',
      description: '棉麻宣纸纹理，温润素雅，适合传统文学与国学。',
      preview: '#F7F4ED',
      previewBackgroundImage:
        'linear-gradient(90deg, rgba(200, 190, 170, 0.08) 1px, transparent 0), linear-gradient(180deg, rgba(200, 190, 170, 0.08) 1px, transparent 0)',
      previewBackgroundSize: '16px 16px',
    },
    {
      value: 'warm-amber',
      label: '暖调琥珀',
      description: '暖调琥珀底色，柔和护眼，适合长时间沉浸阅读。',
      preview: '#F6EDD9',
    },
    {
      value: 'eye-green',
      label: '豆沙护眼绿',
      description: '经典豆沙护眼绿，缓解视觉疲劳，适合长文本阅读。',
      preview: '#C7EDCC',
    },
    {
      value: 'soft-cyan',
      label: '静谧青蓝',
      description: '静谧青蓝底色，清冷宁神，适合学术与专注阅读。',
      preview: '#DCEFF2',
    },
    {
      value: 'jade-white',
      label: '温润冷灰',
      description: '接近羊脂玉的极简冷灰底色，清爽耐看。',
      preview: '#F2F4F5',
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
    value: 'dark-night',
    label: '暗夜深邃',
    description: '暗夜深邃黑，柔和不刺眼，适合夜间沉浸阅读。',
    preview: '#1A1A1A',
  },
  {
    value: 'pure-black',
    label: '极黑 OLED',
    description: '纯黑 OLED 底色，极致省电，适合 AMOLED 屏幕。',
    preview: '#000000',
  },
]

const READER_RUNTIME_OVERRIDES: Record<
  AppThemeMode,
  Partial<Record<ReaderBackgroundPreset, Partial<ReaderRuntimePalette>>>
> = {
  light: {
    default: {},
    parchment: {
      viewportBackground: '#F4EBD0',
      contentBackground: '#F4EBD0',
      backgroundImage:
        'radial-gradient(hsla(40, 30%, 80%, 0.5), hsla(38, 25%, 70%, 0.6)), repeating-radial-gradient(transparent 0, transparent 2px, rgba(139, 90, 43, 0.03) 3px, transparent 4px)',
      surface: '#E9DCB6',
      surfaceStrong: '#F9F1D9',
      text: '#3D2C1D',
      mutedText: '#6B5638',
      link: '#8A5A2B',
      selectionBackground: 'rgba(139, 90, 43, 0.22)',
      selectionColor: '#3D2C1D',
    },
    kraft: {
      viewportBackground: '#D9BE9B',
      contentBackground: '#D9BE9B',
      backgroundImage:
        'radial-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 0), radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 0)',
      backgroundSize: '8px 8px, 12px 12px',
      backgroundPosition: '0 0, 4px 4px',
      surface: '#C9AC85',
      surfaceStrong: '#E4CDAA',
      text: '#2C1D11',
      mutedText: '#5C4630',
      link: '#7A4A1F',
      selectionBackground: 'rgba(44, 29, 17, 0.2)',
      selectionColor: '#2C1D11',
    },
    xuan: {
      viewportBackground: '#F7F4ED',
      contentBackground: '#F7F4ED',
      backgroundImage:
        'linear-gradient(90deg, rgba(200, 190, 170, 0.08) 1px, transparent 0), linear-gradient(180deg, rgba(200, 190, 170, 0.08) 1px, transparent 0)',
      backgroundSize: '16px 16px',
      surface: '#EAE5D8',
      surfaceStrong: '#FBF9F4',
      text: '#2B2B2B',
      mutedText: '#5B5B5B',
      link: '#2563EB',
      selectionBackground: 'rgba(37, 99, 235, 0.18)',
      selectionColor: '#2B2B2B',
    },
    'warm-amber': {
      viewportBackground: '#F6EDD9',
      contentBackground: '#F6EDD9',
      surface: '#EBDFC2',
      surfaceStrong: '#FAF3E3',
      text: '#332C22',
      mutedText: '#6B5D43',
      link: '#B45309',
      selectionBackground: 'rgba(180, 83, 9, 0.2)',
      selectionColor: '#332C22',
    },
    'eye-green': {
      viewportBackground: '#C7EDCC',
      contentBackground: '#C7EDCC',
      surface: '#B0DBB6',
      surfaceStrong: '#D4F3D8',
      text: '#1E3320',
      mutedText: '#3F5A42',
      link: '#15803D',
      selectionBackground: 'rgba(22, 101, 52, 0.2)',
      selectionColor: '#1E3320',
    },
    'soft-cyan': {
      viewportBackground: '#DCEFF2',
      contentBackground: '#DCEFF2',
      surface: '#C2DFE5',
      surfaceStrong: '#E6F5F8',
      text: '#1A3038',
      mutedText: '#3E5A63',
      link: '#0E7490',
      selectionBackground: 'rgba(14, 116, 144, 0.2)',
      selectionColor: '#1A3038',
    },
    'jade-white': {
      viewportBackground: '#F2F4F5',
      contentBackground: '#F2F4F5',
      surface: '#E2E6E8',
      surfaceStrong: '#F7F9FA',
      text: '#22252A',
      mutedText: '#565C64',
      link: '#2563EB',
      selectionBackground: 'rgba(37, 99, 235, 0.18)',
      selectionColor: '#22252A',
    },
  },
  dark: {
    default: {},
    'dark-night': {
      viewportBackground: '#1A1A1A',
      contentBackground: '#1A1A1A',
      surface: '#242424',
      surfaceStrong: '#2A2A2A',
      text: '#A0A0A0',
      mutedText: '#7A7A7A',
      link: '#7AA2C4',
      selectionBackground: 'rgba(160, 160, 160, 0.22)',
      selectionColor: '#A0A0A0',
      imageFilter: 'brightness(0.94) contrast(1.02)',
    },
    'pure-black': {
      viewportBackground: '#000000',
      contentBackground: '#000000',
      surface: '#111111',
      surfaceStrong: '#1A1A1A',
      text: '#888888',
      mutedText: '#5F5F5F',
      link: '#6A9EC4',
      selectionBackground: 'rgba(136, 136, 136, 0.24)',
      selectionColor: '#888888',
      imageFilter: 'brightness(0.9) contrast(1.05)',
    },
  },
}

const normalizeLightBackgroundPreset = (value: unknown): ReaderLightBackgroundPreset => {
  return typeof value === 'string' &&
    LIGHT_BACKGROUND_PRESET_VALUES.has(value as ReaderLightBackgroundPreset)
    ? (value as ReaderLightBackgroundPreset)
    : DEFAULT_READER_BACKGROUND_PRESETS.light
}

const normalizeDarkBackgroundPreset = (value: unknown): ReaderDarkBackgroundPreset => {
  return typeof value === 'string' &&
    DARK_BACKGROUND_PRESET_VALUES.has(value as ReaderDarkBackgroundPreset)
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
  mode: AppThemeMode = getAppliedAppThemeMode(),
): AppThemePalette => {
  return THEME_PALETTES[normalizeAppThemeMode(mode)]
}

export const normalizeReaderBackgroundPresets = (
  presets: Partial<ReaderBackgroundPresets> | null | undefined,
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
    | null,
) => {
  if (
    configOrPresets &&
    typeof configOrPresets === 'object' &&
    'backgroundPresets' in configOrPresets
  ) {
    return normalizeReaderBackgroundPresets(configOrPresets.backgroundPresets)
  }

  return normalizeReaderBackgroundPresets(
    configOrPresets as Partial<ReaderBackgroundPresets> | null | undefined,
  )
}

export const getReaderBackgroundPresetOptions = (mode: AppThemeMode = getAppliedAppThemeMode()) => {
  return normalizeAppThemeMode(mode) === 'dark'
    ? DARK_BACKGROUND_PRESET_OPTIONS
    : LIGHT_BACKGROUND_PRESET_OPTIONS
}

export const getActiveReaderBackgroundPreset = (
  configOrPresets?:
    | { backgroundPresets?: Partial<ReaderBackgroundPresets> | null }
    | Partial<ReaderBackgroundPresets>
    | null,
  mode: AppThemeMode = getAppliedAppThemeMode(),
) => {
  const normalizedMode = normalizeAppThemeMode(mode)

  return resolveReaderBackgroundPresets(configOrPresets)[normalizedMode]
}

export const getReaderRuntimePalette = (
  configOrPresets?:
    | { backgroundPresets?: Partial<ReaderBackgroundPresets> | null }
    | Partial<ReaderBackgroundPresets>
    | null,
  mode: AppThemeMode = getAppliedAppThemeMode(),
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

export const buildReaderBackgroundDeclarations = (
  palette: ReaderRuntimePalette,
): Record<string, string> => {
  const declarations: Record<string, string> = {
    background: palette.contentBackground,
    'background-color': palette.contentBackground,
  }

  if (palette.backgroundImage) {
    declarations['background-image'] = palette.backgroundImage
  }
  if (palette.backgroundSize) {
    declarations['background-size'] = palette.backgroundSize
  }
  if (palette.backgroundPosition) {
    declarations['background-position'] = palette.backgroundPosition
  }

  return declarations
}

export const getReaderThemeCompatColors = (
  configOrPresets?:
    | { backgroundPresets?: Partial<ReaderBackgroundPresets> | null }
    | Partial<ReaderBackgroundPresets>
    | null,
  mode: AppThemeMode = getAppliedAppThemeMode(),
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
  mode: AppThemeMode = getAppliedAppThemeMode(),
): T => {
  return {
    ...config,
    ...getReaderThemeCompatColors(config, mode),
  }
}
