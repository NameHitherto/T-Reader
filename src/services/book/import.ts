import { BookConfig } from '@/types/book'
import type { ImportBookParams } from '@/services/book/types'
import { parseEpubMeta } from '@/services/book/epubParser'
import { buildBookTitle } from '@/services/book/identity'
import { logInfo } from '@/utils/logger'

export const buildBookConfigFromImport = async (params: ImportBookParams): Promise<BookConfig> => {
  const { originalFileName, format } = params

  const meta = await parseEpubMeta(params.fileBuffer)
  const nextConfig: BookConfig = {
    name: buildBookTitle(meta.title),
    author: meta.author,
    durChapterIndex: 0,
    durChapterPos: 0,
    durChapterTitle: '',
    durChapterTime: Date.now(),
  }

  logInfo('book-import', 'build-book-config:done', {
    fileName: originalFileName,
    format,
    bookTitle: nextConfig.name,
    title: meta.title,
  })
  return nextConfig
}
