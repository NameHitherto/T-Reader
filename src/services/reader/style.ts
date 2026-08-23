import { getAppliedAppThemeMode, getReaderRuntimePalette } from '@/services/theme'
import type { AppThemeMode } from '@/services/settings'
import type { ReaderStyleConfig } from '@/services/reader/types'
import { applyEpubReaderStyles } from '@/services/reader/epubStyle'
import type { EpubRenditionLike } from '@/types/epub'

export type { ReaderStyleConfig, ReaderRenditionLike } from '@/services/reader/types'

export const applyReaderStyles = (
  readerConfig: ReaderStyleConfig,
  readerDefaultTheme: Record<string, unknown>,
  rendition: EpubRenditionLike | null,
  themeMode: AppThemeMode = getAppliedAppThemeMode(),
  applyIframeStyle = true,
) => {
  const palette = getReaderRuntimePalette(readerConfig, themeMode)
  const backgroundImage = palette.backgroundImage || 'none'
  const backgroundSize = palette.backgroundSize || 'auto'
  const backgroundPosition = palette.backgroundPosition || '0 0'

  document.documentElement.style.setProperty('--reader-background', palette.viewportBackground)
  document.documentElement.style.setProperty('--reader-background-image', backgroundImage)
  document.documentElement.style.setProperty('--reader-background-size', backgroundSize)
  document.documentElement.style.setProperty('--reader-background-position', backgroundPosition)
  document.documentElement.style.setProperty(
    '--reader-content-background',
    palette.contentBackground,
  )
  document.documentElement.style.setProperty('--reader-surface', palette.surface)
  document.documentElement.style.setProperty('--reader-surface-strong', palette.surfaceStrong)
  document.documentElement.style.setProperty('--reader-text', palette.text)
  document.documentElement.style.setProperty('--reader-text-muted', palette.mutedText)
  document.documentElement.style.setProperty('--reader-selection-bg', palette.selectionBackground)
  document.documentElement.style.setProperty('--reader-selection-text', palette.selectionColor)
  document.documentElement.style.setProperty('--reader-image-filter', palette.imageFilter)

  const applyViewportBackground = (element: HTMLElement) => {
    element.style.backgroundColor = palette.viewportBackground
    element.style.backgroundImage = backgroundImage
    element.style.backgroundSize = backgroundSize
    element.style.backgroundPosition = backgroundPosition
  }

  applyViewportBackground(document.body)
  document.body.style.color = palette.text
  applyViewportBackground(document.documentElement)
  document.documentElement.style.color = palette.text

  const readerRoot = document.getElementById('reader-app')
  if (readerRoot) {
    applyViewportBackground(readerRoot)
    readerRoot.style.color = palette.text
  }

  const epubReader = document.getElementById('epub-reader')
  if (epubReader) {
    applyViewportBackground(epubReader)
    epubReader.style.color = palette.text
  }

  if (!applyIframeStyle) {
    return undefined
  }

  return applyEpubReaderStyles(readerConfig, readerDefaultTheme, rendition, palette)
}
