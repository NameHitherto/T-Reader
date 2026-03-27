import { BookConfig } from '@/js/map'
import { ImportBookParams } from '@/services/book/types'
import { parseEpubMeta } from '@/services/book/parsers/epubParser'
import { parseTxtMeta } from '@/services/book/parsers/txtParser'
import { buildBookTitle } from '@/services/book/bookIdentity'
import { buildTxtProgressSnapshot } from '@/services/reader/progressSnapshotService'
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
    name: buildBookTitle(meta.title),
    author: meta.author,
    ...(format === 'epub'
      ? {
          durChapterIndex: 0,
          durChapterPos: 0,
          durChapterTitle: '',
          durChapterTime: Date.now(),
        }
      : buildTxtProgressSnapshot(0)),
  }

  finishLog({
    bookTitle: nextConfig.name,
    title: meta.title,
  })
  return nextConfig
}
