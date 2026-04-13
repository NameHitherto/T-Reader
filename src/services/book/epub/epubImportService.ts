import { BookImportHandler } from '@/services/book/types'
import { parseEpubMeta } from '@/services/book/epub/epubParser'
import { buildBookTitle } from '@/services/book/bookIdentity'

export const epubBookImportHandler: BookImportHandler = {
  async parseMeta({ fileBuffer }) {
    return await parseEpubMeta(fileBuffer)
  },
  buildInitialBookConfig(meta) {
    return {
      name: buildBookTitle(meta.title),
      author: meta.author,
      durChapterIndex: 0,
      durChapterPos: 0,
      durChapterTitle: '',
      durChapterTime: Date.now(),
    }
  },
}
