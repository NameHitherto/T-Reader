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
  rendition: ReaderRenditionLike | null
) => {
  // 背景颜色
  document.body.style.backgroundColor = readerConfig.color

  const isDarkBackground = readerConfig.color === '#000000'
  document.querySelectorAll('img').forEach((img) => {
    img.style.filter = isDarkBackground ? 'invert(1)' : 'invert(0)'
  })

  const setDarkClass = (selector: string) => {
    document.querySelectorAll(selector).forEach((node) => {
      if (isDarkBackground) {
        node.classList.add('dark')
      } else {
        node.classList.remove('dark')
      }
    })
  }

  setDarkClass('.titlebar-front-button')
  setDarkClass('.titlebar-button')
  setDarkClass('.button')

  // EPUB 阅读器样式
  rendition?.themes.default(readerDefaultTheme)
  rendition?.flow(readerConfig.flow)
  // 刷新呈现，应用更改
  rendition?.layout(null)

  // TXT 样式
  const txtReader = document.getElementById('txt-reader')
  const txtContent = document.getElementById('txt-reader-content')
  if (txtReader && txtContent) {
    txtReader.style.backgroundColor = readerConfig.color
    txtReader.style.color = readerConfig.fontColor
    txtContent.style.fontFamily = readerConfig.font
    txtContent.style.fontSize = `${readerConfig.fontSize}px`
    txtContent.style.lineHeight = `${readerConfig.lineSpacing}em`
    txtContent.style.letterSpacing = `${readerConfig.letterSpacing}px`
  }
}
