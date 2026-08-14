import { BookConfig } from '@/types/book'
import { ImportBookParams } from '@/services/book/types'
import { epubBookImportHandler } from '@/services/book/epub/epubImportService'
import { logInfo } from '@/utils/logger'

export const buildBookConfigFromImport = async (params: ImportBookParams): Promise<BookConfig> => {
  const { originalFileName, format } = params

  const meta = await epubBookImportHandler.parseMeta(params)
  const nextConfig = epubBookImportHandler.buildInitialBookConfig(meta)

  logInfo('book-import', 'build-book-config:done', {
    fileName: originalFileName,
    format,
    bookTitle: nextConfig.name,
    title: meta.title,
  })
  return nextConfig
}
