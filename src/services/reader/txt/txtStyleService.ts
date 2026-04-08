import { getReaderRuntimePalette } from '@/services/theme/themeService'
import type { ReaderStyleConfig } from '@/services/reader/readerStyleService'

type ReaderPalette = ReturnType<typeof getReaderRuntimePalette>

export const applyTxtReaderStyles = (
  readerConfig: ReaderStyleConfig,
  palette: ReaderPalette
) => {
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
