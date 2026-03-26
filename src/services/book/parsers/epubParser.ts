import ePub from 'libs/epub.js'
import { convertBlobToBase64 } from '@/js/utils.js'
import { ParsedBookMeta } from '@/services/book/types'

interface ParseEpubMetaOptions {
  includeCover?: boolean
}

export const parseEpubMeta = async (
  buffer: ArrayBuffer,
  options: ParseEpubMetaOptions = {}
): Promise<ParsedBookMeta> => {
  const book = ePub(buffer)

  try {
    const metadata = await book.loaded.metadata

    let cover = ''
    if (options.includeCover) {
      const coverBlobUrl = await book.coverUrl()
      cover = coverBlobUrl ? await convertBlobToBase64(coverBlobUrl) : ''
    }

    return {
      format: 'epub',
      title: metadata.title || '未知书名',
      author: metadata.creator || '未知作者',
      cover,
    }
  } finally {
    try {
      book.destroy?.()
    } catch (error) {
      console.warn('销毁 EPUB 元数据实例失败:', error)
    }
  }
}
