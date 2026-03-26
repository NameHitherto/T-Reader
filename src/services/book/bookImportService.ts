import { BookConfig } from '@/js/map'
import { ImportBookParams } from '@/services/book/types'
import { parseEpubMeta } from '@/services/book/parsers/epubParser'
import { parseTxtMeta } from '@/services/book/parsers/txtParser'
import { buildBookIdentity } from '@/services/book/bookIdentity'

export const buildBookConfigFromImport = async (
  params: ImportBookParams
): Promise<BookConfig> => {
  const { originalFileName, format, fileBuffer } = params

  const meta =
    format === 'epub' ? await parseEpubMeta(fileBuffer) : parseTxtMeta(originalFileName)

  return {
    id: buildBookIdentity(meta.title, meta.author),
    title: meta.title,
    author: meta.author,
    location: format === 'epub' ? '' : '0',
    updatedAt: new Date().toISOString(),
  }
}
