import { BookConfig } from '@/js/map'
import { ImportBookParams } from '@/services/book/types'
import { parseEpubMeta } from '@/services/book/parsers/epubParser'
import { parseTxtMeta } from '@/services/book/parsers/txtParser'
import { buildInitialSyncMeta } from '@/services/sync/syncMetaService'

export const buildBookConfigFromImport = async (
  params: ImportBookParams
): Promise<BookConfig> => {
  const { id, sourcePath, format, fileSizeMB, fileBuffer } = params

  const meta =
    format === 'epub' ? await parseEpubMeta(fileBuffer) : parseTxtMeta(sourcePath)

  const now = new Date().toLocaleDateString()
  return {
    ...buildInitialSyncMeta(),
    id,
    format,
    locationFormat: format === 'epub' ? 'cfi' : 'paragraph',
    progress: 0,
    cover: meta.cover,
    title: meta.title,
    author: meta.author,
    language: meta.language,
    size: `${fileSizeMB}MB`,
    lastRead: now,
    added: now,
    path: sourcePath,
    location: format === 'epub' ? '' : '0',
  }
}
