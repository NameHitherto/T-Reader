import {
  getAppliedAppThemeMode,
  getAppThemePalette,
} from '@/services/theme/themeService'
import type { AppThemeMode } from '@/services/settings/appSettingsService'

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
  const palette = getAppThemePalette(themeMode)

  document.body.style.backgroundColor = palette.readerBackground
  document.body.style.color = palette.readerText
  document.documentElement.style.backgroundColor = palette.readerBackground

  const resolvedTheme = {
    ...readerDefaultTheme,
    body: {
      ...(readerDefaultTheme.body || {}),
      color: palette.readerText,
      background: palette.readerBackground,
      'background-color': palette.readerBackground,
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
    txtReader.style.backgroundColor = palette.readerBackground
    txtReader.style.color = palette.readerText
    txtContent.style.fontFamily = readerConfig.font
    txtContent.style.fontSize = `${readerConfig.fontSize}px`
    txtContent.style.lineHeight = `${readerConfig.lineSpacing}em`
    txtContent.style.letterSpacing = `${readerConfig.letterSpacing}px`
    txtContent.style.color = palette.readerText
  }
}
