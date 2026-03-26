import ePub from 'libs/epub.js'
import JSZip from 'jszip'
import { loadBookBinary, loadBookConfig } from '@/services/book/bookRepository'

export const extractEpubContent = async (bookName: string): Promise<string> => {
  const bookConfig = await loadBookConfig(bookName)
  const loadedBook = await loadBookBinary(bookConfig)

  if (loadedBook.format !== 'epub') {
    return new TextDecoder().decode(loadedBook.bookData).slice(0, 10000)
  }

  const arrayBuffer = loadedBook.bookData.buffer.slice(
    loadedBook.bookData.byteOffset,
    loadedBook.bookData.byteOffset + loadedBook.bookData.byteLength
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
      console.error(error)
    }
  }

  return fullText.substring(0, 10000)
}
