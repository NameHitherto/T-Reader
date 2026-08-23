import {
  buildReaderBackgroundDeclarations,
  getReaderRuntimePalette,
} from '@/services/theme/themeService'
import type { ReaderRenditionLike, ReaderStyleConfig } from './types'

type ReaderPalette = ReturnType<typeof getReaderRuntimePalette>

const serializeCssDeclaration = (declarations: Record<string, unknown>) => {
  return Object.entries(declarations)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([property, value]) => `${property}: ${String(value)};`)
    .join('\n')
}

/**
 * 获取脚注基础样式
 * 这些样式会在样式隔离启用时注入到 iframe 中
 */
export const getFootnoteBaseStyles = (): string => {
  return `
    /* 脚注图标 */
    img[class~="footnote"] {
      max-width: 1em !important;
    }
  `
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
