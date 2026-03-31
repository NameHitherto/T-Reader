import {
  getAppliedAppThemeMode,
  getReaderRuntimePalette,
} from '@/services/theme/themeService'
import type { AppThemeMode } from '@/services/settings/appSettingsService'
import type { ReaderBackgroundPresets } from '@/types/readerBackground'

export interface ReaderStyleConfig {
  font: string
  fontSize: number
  fontWeight: number
  lineSpacing: number
  paragraphSpacing: number
  letterSpacing: number
  boxPaddingTop: number
  boxPaddingBottom: number
  boxPaddingHorizontal: number
  columnCount: number
  indent: number
  color: string
  fontColor: string
  backgroundPresets: ReaderBackgroundPresets
  flow: string
}

interface ReaderRenditionLike {
  themes: {
    default: (theme: Record<string, any>) => void
  }
  flow: (flowMode: string) => void
  layout: (layout: any) => void
}

export const applyReaderStyles = (
  readerConfig: ReaderStyleConfig,
  readerDefaultTheme: Record<string, any>,
  rendition: ReaderRenditionLike | null,
  themeMode: AppThemeMode = getAppliedAppThemeMode()
) => {
  const palette = getReaderRuntimePalette(readerConfig, themeMode)

  document.documentElement.style.setProperty('--reader-background', palette.viewportBackground)
  document.documentElement.style.setProperty(
    '--reader-content-background',
    palette.contentBackground
  )
  document.documentElement.style.setProperty('--reader-surface', palette.surface)
  document.documentElement.style.setProperty('--reader-surface-strong', palette.surfaceStrong)
  document.documentElement.style.setProperty('--reader-text', palette.text)
  document.documentElement.style.setProperty('--reader-text-muted', palette.mutedText)
  document.documentElement.style.setProperty(
    '--reader-selection-bg',
    palette.selectionBackground
  )
  document.documentElement.style.setProperty(
    '--reader-selection-text',
    palette.selectionColor
  )
  document.documentElement.style.setProperty('--reader-image-filter', palette.imageFilter)

  document.body.style.background = palette.viewportBackground
  document.body.style.color = palette.text
  document.documentElement.style.background = palette.viewportBackground
  document.documentElement.style.color = palette.text

  const readerRoot = document.getElementById('reader-app')
  if (readerRoot) {
    readerRoot.style.background = palette.viewportBackground
    readerRoot.style.color = palette.text
  }

  const epubReader = document.getElementById('epub-reader')
  if (epubReader) {
    epubReader.style.background = palette.viewportBackground
    epubReader.style.color = palette.text
  }

  const resolvedTheme = {
    ...readerDefaultTheme,
    html: {
      ...(readerDefaultTheme.html || {}),
      background: palette.contentBackground,
      'background-color': palette.contentBackground,
    },
    body: {
      ...(readerDefaultTheme.body || {}),
      color: palette.text,
      background: palette.contentBackground,
      'background-color': palette.contentBackground,
    },
  }

  // EPUB 阅读器样式
  rendition?.themes.default(resolvedTheme)
  rendition?.flow(readerConfig.flow)
  // 刷新呈现，应用更改
  rendition?.layout(null)

  // TXT 样式
  const txtReader = document.getElementById('txt-reader')
  const txtContent = document.getElementById('txt-reader-content')
  if (txtReader && txtContent) {
    txtReader.style.background = palette.viewportBackground
    txtReader.style.color = palette.text
    txtContent.style.background = palette.contentBackground
    txtContent.style.fontFamily = readerConfig.font
    txtContent.style.fontSize = `${readerConfig.fontSize}px`
    txtContent.style.lineHeight = `${readerConfig.lineSpacing}em`
    txtContent.style.letterSpacing = `${readerConfig.letterSpacing}px`
    txtContent.style.color = palette.text
  }
}
