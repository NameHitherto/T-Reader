import { getReaderRuntimePalette } from '@/services/theme/themeService'
import type { ReaderStyleConfig } from '@/services/reader/readerStyleService'
import {
  buildReaderFontApplication,
  syncReaderSystemFontStyle,
} from '@/services/reader/readerFontApplicationService'

type ReaderPalette = ReturnType<typeof getReaderRuntimePalette>

export const applyTxtReaderStyles = (
  readerConfig: ReaderStyleConfig,
  palette: ReaderPalette
) => {
  const fontApplication = buildReaderFontApplication(
    readerConfig.font,
    readerConfig.enabledSystemFonts
  )
  syncReaderSystemFontStyle(fontApplication)

  const txtReader = document.getElementById('txt-reader')
  const txtContent = document.getElementById('txt-reader-content')
  if (txtReader && txtContent) {
    txtReader.style.background = palette.viewportBackground
    txtReader.style.color = palette.text
    txtReader.style.fontFamily = fontApplication.fontFamilyCss
    txtContent.style.background = palette.contentBackground
    txtContent.style.fontFamily = fontApplication.fontFamilyCss
    txtContent.style.fontSize = `${readerConfig.fontSize}px`
    txtContent.style.lineHeight = `${readerConfig.lineSpacing}em`
    txtContent.style.letterSpacing = `${readerConfig.letterSpacing}px`
    txtContent.style.color = palette.text
  }
}
