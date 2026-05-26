import ePub from 'libs/epub.js'
import JSZip from 'jszip'
import { logError } from '@/utils/logger'

export const extractEpubContent = async (bookData: Uint8Array): Promise<string> => {
  const arrayBuffer = bookData.buffer.slice(
    bookData.byteOffset,
    bookData.byteOffset + bookData.byteLength,
  ) as ArrayBuffer
  const book = ePub(arrayBuffer)
  await book.ready

  let fullText = ''
  const zip = new JSZip()
  const zipData = await zip.loadAsync(arrayBuffer)
  const toc = book.navigation.toc
  const parser = new DOMParser()

  for (const item of toc) {
    const chapterHref = item.href
    let filePath = ''
    try {
      if (zipData.folder('OEBPS')) {
        filePath = `OEBPS/${chapterHref}`
      }

      const chapterContent = await zipData.file(filePath)?.async('string')
      if (chapterContent) {
        const htmlDoc = parser.parseFromString(chapterContent, 'text/html')
        const textContent = htmlDoc.body.textContent
        const cleanText = textContent?.replace(/\s+/g, ' ').trim()
        fullText += `${cleanText}\n\n`
      }
    } catch (error) {
      logError('epubContent', '提取 EPUB 内容失败', error)
    }
  }

  return fullText.substring(0, 10000)
}
