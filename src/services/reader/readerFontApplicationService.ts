import { DEFAULT_READER_FONT, type EnabledSystemFont } from '@/types/readerFonts'
import { getEnabledFontByValue } from '@/services/reader/systemFontService'

export const ACTIVE_READER_FONT_FAMILY = 'TReaderActiveFont'
export const READER_SYSTEM_FONT_STYLE_ID = 'reader-system-font-style'

export interface ReaderFontApplication {
  resolvedFont: EnabledSystemFont | null
  fontFamilyCss: string
  fontFaceThemeBlock: Record<string, string> | null
  fontFaceRule: string | null
  localSources: string[]
}

const escapeCssString = (value: string) => {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

const dedupeNames = (...values: Array<string | null | undefined>) => {
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

const buildLocalSrcValue = (fontNames: string[]) => {
  return fontNames.map((name) => `local("${escapeCssString(name)}")`).join(', ')
}

export const getReaderLocalFontCandidates = (
  font: (EnabledSystemFont & { familyAliases?: string[] }) | null,
  rawFontValue = ''
) => {
  if (!font) {
    return dedupeNames(rawFontValue)
  }

  return dedupeNames(
    font.postscriptName,
    font.fullName,
    font.displayFamily,
    font.family,
    ...(font.familyAliases || []),
    rawFontValue
  )
}

export const buildReaderFontApplication = (
  fontValue: string,
  enabledFonts: EnabledSystemFont[]
): ReaderFontApplication => {
  const normalizedValue = fontValue.trim().toLowerCase()
  const isDefaultFont = normalizedValue === DEFAULT_READER_FONT

  if (isDefaultFont) {
    return {
      resolvedFont: null,
      fontFamilyCss: DEFAULT_READER_FONT,
      fontFaceThemeBlock: null,
      fontFaceRule: null,
      localSources: [],
    }
  }

  const resolvedFont = getEnabledFontByValue(enabledFonts, fontValue)
  const localSources = getReaderLocalFontCandidates(resolvedFont, fontValue)

  if (localSources.length === 0) {
    return {
      resolvedFont: resolvedFont || null,
      fontFamilyCss: DEFAULT_READER_FONT,
      fontFaceThemeBlock: null,
      fontFaceRule: null,
      localSources: [],
    }
  }

  const src = buildLocalSrcValue(localSources)

  return {
    resolvedFont: resolvedFont || null,
    fontFamilyCss: `"${ACTIVE_READER_FONT_FAMILY}", ${DEFAULT_READER_FONT}`,
    fontFaceThemeBlock: {
      'font-family': ACTIVE_READER_FONT_FAMILY,
      src,
    },
    fontFaceRule: `@font-face { font-family: "${ACTIVE_READER_FONT_FAMILY}"; src: ${src}; font-display: swap; }`,
    localSources,
  }
}

export const syncReaderSystemFontStyle = (
  fontApplication: ReaderFontApplication,
  targetDocument: Document = document
) => {
  const existingStyle = targetDocument.getElementById(
    READER_SYSTEM_FONT_STYLE_ID
  ) as HTMLStyleElement | null

  if (!fontApplication.fontFaceRule) {
    existingStyle?.remove()
    return
  }

  const styleElement = existingStyle || targetDocument.createElement('style')
  styleElement.id = READER_SYSTEM_FONT_STYLE_ID

  if (styleElement.textContent !== fontApplication.fontFaceRule) {
    styleElement.textContent = fontApplication.fontFaceRule
  }

  if (!styleElement.isConnected) {
    targetDocument.head.appendChild(styleElement)
  }
}
