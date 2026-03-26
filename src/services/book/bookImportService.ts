import { BookConfig } from '@/js/map'
import { ImportBookParams } from '@/services/book/types'
import { parseEpubMeta } from '@/services/book/parsers/epubParser'
import { parseTxtMeta } from '@/services/book/parsers/txtParser'
import { buildBookName } from '@/services/book/bookIdentity'
import { createDurationLogger } from '@/utils/logger'

export const buildBookConfigFromImport = async (
  params: ImportBookParams
): Promise<BookConfig> => {
  const { originalFileName, format, fileBuffer } = params
  const finishLog = createDurationLogger('book-import-service', 'build-book-config', {
    fileName: originalFileName,
    format,
  })

  const meta =
    format === 'epub' ? await parseEpubMeta(fileBuffer) : parseTxtMeta(originalFileName)

  const nextConfig = {
    name: buildBookName(meta.title, meta.author),
    title: meta.title,
    author: meta.author,
    location: format === 'epub' ? '' : '0',
    updatedAt: new Date().toISOString(),
  }

  finishLog({
    bookName: nextConfig.name,
    title: nextConfig.title,
  })
  return nextConfig
}
