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
  display_family: string
  subfamily: string | null
  full_name: string | null
  postscript_name: string | null
  weight: number | null
  path: string | null
  face_index: number
  family_aliases: unknown
}

export interface ReaderFontOption {
  label: string
  value: string
  family: string
  subfamily: string | null
  isDefault: boolean
}

export interface SystemFontFamilyGroup {
  family: string
  displayFamily: string
  entries: SystemFontEntry[]
}

const normalizeSearchText = (value: string | null | undefined) => {
  return (value || '').trim().toLowerCase()
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

const toStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  const result: string[] = []

  for (const item of value) {
    if (typeof item !== 'string') {
      continue
    }

    const trimmed = item.trim()
    const key = trimmed.toLowerCase()
    if (!trimmed || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(trimmed)
  }

  return result
}

const dedupeFontNames = (...values: Array<string | null | undefined>) => {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const trimmed = (value || '').trim()
    const key = trimmed.toLowerCase()
    if (!trimmed || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(trimmed)
  }

  return result
}

const getFontFamilyAliases = (font: SystemFontEntry | EnabledSystemFont) => {
  if ('familyAliases' in font && Array.isArray(font.familyAliases)) {
    return font.familyAliases
  }

  return []
}

export const getSystemFontEntryKey = (
  font: Pick<SystemFontEntry, 'family' | 'postscriptName' | 'fullName' | 'weight' | 'faceIndex'> &
    Partial<Pick<SystemFontEntry, 'path'>>
) => {
  return [
    font.family.trim().toLowerCase(),
    (font.postscriptName || '').trim().toLowerCase(),
    (font.fullName || '').trim().toLowerCase(),
    font.weight ?? '',
    font.faceIndex,
    (font.path || '').trim().toLowerCase(),
  ].join('|')
}

export const getReaderFontValue = (
  font: Pick<SystemFontEntry, 'family' | 'postscriptName' | 'fullName'>
) => {
  return font.postscriptName || font.fullName || font.family
}

export const formatSystemFontLabel = (
  font: Pick<SystemFontEntry, 'family' | 'displayFamily' | 'subfamily' | 'fullName'>
) => {
  if (font.fullName) {
    return font.fullName
  }

  if (font.subfamily) {
    return `${font.displayFamily} ${font.subfamily}`
  }

  return font.displayFamily || font.family
}

export const normalizeSystemFontEntry = (
  font: Partial<SystemFontEntry> | RawSystemFontEntry | EnabledSystemFont
): SystemFontEntry | null => {
  const family = typeof font.family === 'string' ? font.family.trim() : ''
  if (!family) {
    return null
  }

  const displayFamily =
    ('display_family' in font ? toNullableString(font.display_family) : null) ||
    toNullableString((font as Partial<SystemFontEntry>).displayFamily) ||
    family
  const subfamily =
    'subfamily' in font ? toNullableString(font.subfamily) : null
  const fullName =
    ('full_name' in font ? toNullableString(font.full_name) : null) ||
    toNullableString((font as Partial<SystemFontEntry>).fullName)
  const postscriptName =
    ('postscript_name' in font
      ? toNullableString(font.postscript_name)
      : null) || toNullableString((font as Partial<SystemFontEntry>).postscriptName)
  const path =
    ('path' in font ? toNullableString(font.path) : null) ||
    toNullableString((font as Partial<SystemFontEntry>).path)
  const faceIndex =
    ('face_index' in font ? toNullableNumber(font.face_index) : null) ??
    toNullableNumber((font as Partial<SystemFontEntry>).faceIndex) ??
    0
  const familyAliases = dedupeFontNames(
    ...toStringArray(
      'family_aliases' in font
        ? font.family_aliases
        : (font as Partial<SystemFontEntry>).familyAliases
    ),
    displayFamily,
    family
  )

  return {
    family,
    displayFamily,
    subfamily,
    fullName,
    postscriptName,
    weight: toNullableNumber(font.weight),
    path,
    faceIndex,
    familyAliases,
  }
}

export const toEnabledSystemFont = (
  font: Pick<
    SystemFontEntry,
    | 'family'
    | 'displayFamily'
    | 'subfamily'
    | 'fullName'
    | 'postscriptName'
    | 'weight'
    | 'path'
    | 'faceIndex'
    | 'familyAliases'
  >
): EnabledSystemFont => {
  return {
    family: font.family,
    displayFamily: font.displayFamily,
    subfamily: font.subfamily,
    fullName: font.fullName,
    postscriptName: font.postscriptName,
    weight: font.weight,
    path: font.path,
    faceIndex: font.faceIndex,
    familyAliases: font.familyAliases,
  }
}

const compareFontEntries = (left: SystemFontEntry, right: SystemFontEntry) => {
  const weightCompare = (left.weight ?? 400) - (right.weight ?? 400)
  if (weightCompare !== 0) {
    return weightCompare
  }

  const subfamilyCompare = (left.subfamily || 'Regular').localeCompare(
    right.subfamily || 'Regular'
  )
  if (subfamilyCompare !== 0) {
    return subfamilyCompare
  }

  return formatSystemFontLabel(left).localeCompare(formatSystemFontLabel(right))
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
      displayFamily: entries[0]?.displayFamily || family,
      entries: [...entries].sort(compareFontEntries),
    }))
    .sort((left, right) => left.family.localeCompare(right.family))
}

export const orderSystemFontFamilyGroups = (
  groups: SystemFontFamilyGroup[],
  enabledFamilies: Iterable<string>
) => {
  const enabledFamilySet = new Set(
    Array.from(enabledFamilies, (family) => normalizeSearchText(family))
  )
  const enabledGroups: SystemFontFamilyGroup[] = []
  const disabledGroups: SystemFontFamilyGroup[] = []

  for (const group of groups) {
    if (enabledFamilySet.has(normalizeSearchText(group.family))) {
      enabledGroups.push(group)
      continue
    }
    disabledGroups.push(group)
  }

  return [...enabledGroups, ...disabledGroups]
}

export const doesSystemFontGroupMatchKeyword = (
  group: SystemFontFamilyGroup,
  keyword: string
) => {
  const normalizedKeyword = normalizeSearchText(keyword)
  if (!normalizedKeyword) {
    return true
  }

  if (
    [group.family, group.displayFamily].some((value) =>
      normalizeSearchText(value).includes(normalizedKeyword)
    )
  ) {
    return true
  }

  return group.entries.some((entry) => {
    return [
      entry.displayFamily,
      entry.family,
      entry.fullName,
      entry.subfamily,
      entry.postscriptName,
      entry.weight?.toString() || null,
      ...entry.familyAliases,
    ].some((value) => normalizeSearchText(value).includes(normalizedKeyword))
  })
}

const entryMatchesValue = (font: SystemFontEntry | EnabledSystemFont, normalizedValue: string) => {
  if (!normalizedValue) {
    return false
  }

  return [
    getReaderFontValue(font),
    font.fullName,
    font.family,
    font.displayFamily,
    ...getFontFamilyAliases(font),
  ].some((value) => normalizeSearchText(value) === normalizedValue)
}

export const findSystemFontMatch = (fontValue: string, fonts: SystemFontEntry[]) => {
  const normalizedValue = normalizeSearchText(fontValue)
  if (!normalizedValue) {
    return null
  }

  return fonts.find((font) => entryMatchesValue(font, normalizedValue)) || null
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
      findSystemFontMatch(normalized.fullName || normalized.family, systemFonts)

    const enabledFont = matchedFont
      ? toEnabledSystemFont(matchedFont)
      : toEnabledSystemFont(normalized)
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
      subfamily: null,
      isDefault: true,
    },
  ]

  for (const font of enabledFonts) {
    options.push({
      label: formatSystemFontLabel(font),
      value: getReaderFontValue(font),
      family: font.family,
      subfamily: font.subfamily,
      isDefault: false,
    })
  }

  return options
}

export const getEnabledFontByValue = (
  enabledFonts: EnabledSystemFont[],
  fontValue: string
) => {
  const normalizedValue = normalizeSearchText(fontValue)
  return enabledFonts.find((font) => entryMatchesValue(font, normalizedValue)) || null
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
