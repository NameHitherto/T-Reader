import { invoke } from '@tauri-apps/api/core'
import type { ReaderConfig } from '@/store/readerConfigStore'
import type { EnabledSystemFont, SystemFontEntry } from '@/types/readerFonts'
import { DEFAULT_READER_FONT, DEFAULT_READER_FONT_LABEL } from '@/types/readerFonts'
import {
  getReaderThemeCompatColors,
  normalizeReaderBackgroundPresets,
} from '@/services/theme/themeService'
import { createDefaultReaderBackgroundPresets } from '@/types/readerBackground'

interface RawSystemFontEntry {
  family: string
  postscript_name: string | null
  style: string | null
  weight: number | null
  path: string | null
}

export interface ReaderFontOption {
  label: string
  value: string
  family: string
  style: string | null
  isDefault: boolean
}

export interface SystemFontFamilyGroup {
  family: string
  entries: SystemFontEntry[]
}

const toNullableString = (value: unknown) => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const toNullableNumber = (value: unknown) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export const getSystemFontEntryKey = (
  font: Pick<SystemFontEntry, 'family' | 'postscriptName' | 'style' | 'weight'>
) => {
  return [
    font.family.trim().toLowerCase(),
    (font.postscriptName || '').trim().toLowerCase(),
    (font.style || '').trim().toLowerCase(),
    font.weight ?? '',
  ].join('|')
}

export const getReaderFontValue = (
  font: Pick<SystemFontEntry, 'family' | 'postscriptName'>
) => {
  return font.postscriptName || font.family
}

export const formatSystemFontLabel = (
  font: Pick<SystemFontEntry, 'family' | 'style' | 'postscriptName'>
) => {
  const suffix = font.style ? ` · ${font.style}` : ''
  return `${font.family}${suffix}`
}

export const normalizeSystemFontEntry = (
  font: Partial<SystemFontEntry> | RawSystemFontEntry | EnabledSystemFont
): SystemFontEntry | null => {
  const family = typeof font.family === 'string' ? font.family.trim() : ''
  if (!family) {
    return null
  }

  const postscriptName =
    'postscript_name' in font
      ? toNullableString(font.postscript_name)
      : toNullableString(font.postscriptName)

  return {
    family,
    postscriptName,
    style: toNullableString(font.style),
    weight: toNullableNumber(font.weight),
    path: 'path' in font ? toNullableString(font.path) : null,
  }
}

export const toEnabledSystemFont = (
  font: Pick<SystemFontEntry, 'family' | 'postscriptName' | 'style' | 'weight'>
): EnabledSystemFont => {
  return {
    family: font.family,
    postscriptName: font.postscriptName,
    style: font.style,
    weight: font.weight,
  }
}

const compareFontEntries = (left: SystemFontEntry, right: SystemFontEntry) => {
  const weightCompare = (left.weight ?? 400) - (right.weight ?? 400)
  if (weightCompare !== 0) {
    return weightCompare
  }

  const styleCompare = (left.style || 'Regular').localeCompare(right.style || 'Regular')
  if (styleCompare !== 0) {
    return styleCompare
  }

  return getReaderFontValue(left).localeCompare(getReaderFontValue(right))
}

export const fetchSystemFonts = async () => {
  const fonts = await invoke<RawSystemFontEntry[]>('get_system_fonts')
  const normalizedMap = new Map<string, SystemFontEntry>()

  for (const font of fonts) {
    const normalized = normalizeSystemFontEntry(font)
    if (!normalized) {
      continue
    }
    normalizedMap.set(getSystemFontEntryKey(normalized), normalized)
  }

  return Array.from(normalizedMap.values()).sort((left, right) => {
    const familyCompare = left.family.localeCompare(right.family)
    if (familyCompare !== 0) {
      return familyCompare
    }
    return compareFontEntries(left, right)
  })
}

export const groupSystemFontsByFamily = (fonts: SystemFontEntry[]) => {
  const groupMap = new Map<string, SystemFontEntry[]>()

  for (const font of fonts) {
    const current = groupMap.get(font.family) ?? []
    current.push(font)
    groupMap.set(font.family, current)
  }

  return Array.from(groupMap.entries())
    .map<SystemFontFamilyGroup>(([family, entries]) => ({
      family,
      entries: [...entries].sort(compareFontEntries),
    }))
    .sort((left, right) => left.family.localeCompare(right.family))
}

export const findSystemFontMatch = (
  fontValue: string,
  fonts: SystemFontEntry[]
) => {
  const normalizedValue = fontValue.trim().toLowerCase()
  if (!normalizedValue) {
    return null
  }

  return (
    fonts.find((font) => getReaderFontValue(font).trim().toLowerCase() === normalizedValue) ||
    fonts.find((font) => font.family.trim().toLowerCase() === normalizedValue) ||
    null
  )
}

export const normalizeEnabledSystemFonts = (
  fonts: unknown,
  systemFonts: SystemFontEntry[] = []
) => {
  const items = Array.isArray(fonts) ? fonts : []
  const uniqueByFamily = new Map<string, EnabledSystemFont>()

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const normalized = normalizeSystemFontEntry(item as Partial<SystemFontEntry>)
    if (!normalized) {
      continue
    }

    const matchedFont =
      findSystemFontMatch(getReaderFontValue(normalized), systemFonts) ||
      findSystemFontMatch(normalized.family, systemFonts)

    const enabledFont = matchedFont ? toEnabledSystemFont(matchedFont) : toEnabledSystemFont(normalized)
    uniqueByFamily.set(enabledFont.family.toLowerCase(), enabledFont)
  }

  return Array.from(uniqueByFamily.values()).sort((left, right) =>
    left.family.localeCompare(right.family)
  )
}

export const buildReaderFontOptions = (enabledFonts: EnabledSystemFont[]): ReaderFontOption[] => {
  const options: ReaderFontOption[] = [
    {
      label: DEFAULT_READER_FONT_LABEL,
      value: DEFAULT_READER_FONT,
      family: DEFAULT_READER_FONT,
      style: null,
      isDefault: true,
    },
  ]

  for (const font of enabledFonts) {
    options.push({
      label: formatSystemFontLabel(font),
      value: getReaderFontValue(font),
      family: font.family,
      style: font.style,
      isDefault: false,
    })
  }

  return options
}

export const getEnabledFontByValue = (
  enabledFonts: EnabledSystemFont[],
  fontValue: string
) => {
  const normalizedValue = fontValue.trim().toLowerCase()
  return (
    enabledFonts.find(
      (font) => getReaderFontValue(font).trim().toLowerCase() === normalizedValue
    ) ||
    enabledFonts.find((font) => font.family.trim().toLowerCase() === normalizedValue) ||
    null
  )
}

export const normalizeReaderConfig = (
  config: Partial<ReaderConfig> | null | undefined,
  systemFonts: SystemFontEntry[]
): ReaderConfig => {
  const backgroundPresets = normalizeReaderBackgroundPresets(config?.backgroundPresets)
  const baseConfig: ReaderConfig = {
    ...getReaderThemeCompatColors(backgroundPresets),
    fontSize: 16,
    fontWeight: 400,
    lineSpacing: 1.3,
    paragraphSpacing: 0.2,
    letterSpacing: 0,
    boxPaddingTop: 20,
    boxPaddingBottom: 20,
    boxPaddingHorizontal: 20,
    columnCount: 2,
    indent: 2,
    font: DEFAULT_READER_FONT,
    backgroundPresets: createDefaultReaderBackgroundPresets(),
    flow: 'paginated',
    enabledSystemFonts: [],
  }

  const mergedConfig = {
    ...baseConfig,
    ...(config || {}),
  } as ReaderConfig

  const enabledSystemFonts = normalizeEnabledSystemFonts(
    (config as Partial<ReaderConfig> | undefined)?.enabledSystemFonts,
    systemFonts
  )

  const matchedEnabledFont =
    mergedConfig.font === DEFAULT_READER_FONT
      ? null
      : getEnabledFontByValue(enabledSystemFonts, mergedConfig.font)

  return {
    ...mergedConfig,
    backgroundPresets,
    font:
      mergedConfig.font === DEFAULT_READER_FONT
        ? DEFAULT_READER_FONT
        : matchedEnabledFont
          ? getReaderFontValue(matchedEnabledFont)
          : DEFAULT_READER_FONT,
    enabledSystemFonts,
  }
}
