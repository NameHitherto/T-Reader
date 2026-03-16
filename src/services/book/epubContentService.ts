import ePub from 'libs/epub.js'
import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import JSZip from 'jszip'

/**
 * 从EPUB书籍中提取纯文本内容
 */
export const extractEpubContent = async (bookName: string): Promise<string> => {
  const bookData = await readFile(`T-Reader/${bookName}.epub`, {
    baseDir: BaseDirectory.Document,
  })

  const arrayBuffer = (() => {
    const buf = new ArrayBuffer(bookData.byteLength)
    new Uint8Array(buf).set(bookData)
    return buf
  })()

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
      } else {
        console.error('未找到OEBPS文件夹')
      }

      const chapterContent = await zipData.file(filePath)?.async('string')
      if (chapterContent) {
        const htmlDoc = parser.parseFromString(chapterContent, 'text/html')
        const textContent = htmlDoc.body.textContent
        const cleanText = textContent?.replace(/\s+/g, ' ').trim()
        fullText += cleanText + '\n\n'
      }
    } catch (e) {
      console.error(e)
    }
  }

  return fullText.substring(0, 10000)
}
