import {
  getAppliedAppThemeMode,
  getReaderRuntimePalette,
} from '@/services/theme/themeService'
import type { AppThemeMode } from '@/services/settings/appSettingsService'
import type { ReaderBackgroundPresets } from '@/types/readerBackground'
import type { EnabledSystemFont } from '@/types/readerFonts'
import { applyEpubReaderStyles } from '@/services/reader/epub/epubStyleService'
import type { EpubRenditionLike } from '@/types/epub'

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
  enabledSystemFonts: EnabledSystemFont[]
}

export interface ReaderRenditionLike {
  themes: {
    default: (theme: Record<string, unknown>) => void
  }
  flow: (flowMode: string) => void
  layout: (layout: unknown) => void
}

export const applyReaderStyles = (
  readerConfig: ReaderStyleConfig,
  readerDefaultTheme: Record<string, unknown>,
  rendition: EpubRenditionLike | null,
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

  applyEpubReaderStyles(readerConfig, readerDefaultTheme, rendition, palette)
}
