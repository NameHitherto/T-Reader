import ePub from 'libs/epub.js'
import { invoke } from '@tauri-apps/api/core'
import JSZip from 'jszip'
import { getLocalDirNames } from '@/services/fileSystem/dirService'

/**
 * 从 EPUB 书籍中提取纯文本内容
 */
export const extractEpubContent = async (bookName: string): Promise<string> => {
  const dirs = await getLocalDirNames()
  const bookData = await invoke('read_file', {
    subdir: dirs.books,
    filename: `${bookName}.epub`,
  })
  const bytes = bookData instanceof Uint8Array
    ? bookData
    : Array.isArray(bookData)
      ? Uint8Array.from(bookData)
      : new Uint8Array(bookData as ArrayBufferLike)
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
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
      } else {
        console.error('未找到 OEBPS 文件夹')
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
