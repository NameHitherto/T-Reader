import { BookConfig } from '@/types/book'
import { ImportBookParams } from '@/services/book/types'
import { epubBookImportHandler } from '@/services/book/epub/epubImportService'
import { createDurationLogger } from '@/utils/logger'

export const buildBookConfigFromImport = async (
  params: ImportBookParams
): Promise<BookConfig> => {
  const { originalFileName, format } = params
  const finishLog = createDurationLogger('book-import-service', 'build-book-config', {
    fileName: originalFileName,
    format,
  })

  const meta = await epubBookImportHandler.parseMeta(params)
  const nextConfig = epubBookImportHandler.buildInitialBookConfig(meta)

  finishLog({
    bookTitle: nextConfig.name,
    title: meta.title,
  })
  return nextConfig
}
