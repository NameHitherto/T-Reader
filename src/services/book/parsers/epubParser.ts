import ePub from 'libs/epub.js'
import { convertBlobToBase64 } from '@/js/utils.js'
import { ParsedBookMeta } from '@/services/book/types'

export const parseEpubMeta = async (buffer: ArrayBuffer): Promise<ParsedBookMeta> => {
  const book = ePub(buffer)
  const metadata = await book.loaded.metadata
  const coverBlob = await book.coverUrl()
  const cover = coverBlob ? await convertBlobToBase64(coverBlob) : ''

  return {
    format: 'epub',
    title: metadata.title || '未知书名',
    author: metadata.creator || '未知作者',
    language: metadata.language || '未知',
    cover,
  }
}
