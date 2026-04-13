import { BookConfig } from '@/types/book'
import { ImportBookParams } from '@/services/book/types'
import { epubBookImportHandler } from '@/services/book/epub/epubImportService'
import { txtBookImportHandler } from '@/services/book/txt/txtImportService'
import { createDurationLogger } from '@/utils/logger'

const BOOK_IMPORT_HANDLERS = {
  epub: epubBookImportHandler,
  txt: txtBookImportHandler,
} as const

export const parseBookMetaByFormat = async (params: ImportBookParams) => {
  return await BOOK_IMPORT_HANDLERS[params.format].parseMeta(params)
}

export const buildBookConfigFromImport = async (
  params: ImportBookParams
): Promise<BookConfig> => {
  const { originalFileName, format } = params
  const finishLog = createDurationLogger('book-import-service', 'build-book-config', {
    fileName: originalFileName,
    format,
  })

  const meta = await parseBookMetaByFormat(params)
  const nextConfig = BOOK_IMPORT_HANDLERS[format].buildInitialBookConfig(meta)

  finishLog({
    bookTitle: nextConfig.name,
    title: meta.title,
  })
  return nextConfig
}
