import {
  buildReaderBackgroundDeclarations,
  getReaderRuntimePalette,
} from '@/services/theme/themeService'
import type { ReaderRenditionLike, ReaderStyleConfig } from '@/services/reader/readerStyleService'

type ReaderPalette = ReturnType<typeof getReaderRuntimePalette>

const serializeCssDeclaration = (declarations: Record<string, unknown>) => {
  return Object.entries(declarations)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([property, value]) => `${property}: ${String(value)};`)
    .join('\n')
}

export const serializeReaderThemeCss = (theme: Record<string, unknown>) => {
  return Object.entries(theme)
    .map(([selector, declarations]) => {
      if (!declarations || typeof declarations !== 'object' || Array.isArray(declarations)) {
        return ''
      }

      const serializedDeclarations = serializeCssDeclaration(
        declarations as Record<string, unknown>,
      )
      if (!serializedDeclarations) {
        return ''
      }

      return `${selector} {\n${serializedDeclarations}\n}`
    })
    .filter(Boolean)
    .join('\n\n')
}

export const applyEpubReaderStyles = (
  readerConfig: ReaderStyleConfig,
  readerDefaultTheme: Record<string, unknown>,
  rendition: ReaderRenditionLike | null,
  palette: ReaderPalette,
) => {
  const resolvedTheme = {
    ...readerDefaultTheme,
    html: {
      ...(readerDefaultTheme.html || {}),
      ...buildReaderBackgroundDeclarations(palette),
    },
    body: {
      ...(readerDefaultTheme.body || {}),
      color: palette.text,
      ...buildReaderBackgroundDeclarations(palette),
    },
  }

  rendition?.themes.default(resolvedTheme)
  rendition?.flow(readerConfig.flow)
  rendition?.layout(null)
}
