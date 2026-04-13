import { getReaderRuntimePalette } from '@/services/theme/themeService'
import type {
  ReaderRenditionLike,
  ReaderStyleConfig,
} from '@/services/reader/readerStyleService'

type ReaderPalette = ReturnType<typeof getReaderRuntimePalette>

export const applyEpubReaderStyles = (
  readerConfig: ReaderStyleConfig,
  readerDefaultTheme: Record<string, any>,
  rendition: ReaderRenditionLike | null,
  palette: ReaderPalette
) => {
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

  rendition?.themes.default(resolvedTheme)
  rendition?.flow(readerConfig.flow)
  rendition?.layout(null)
}
