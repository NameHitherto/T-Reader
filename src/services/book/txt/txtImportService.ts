import { buildBookTitle } from '@/services/book/bookIdentity'
import { buildTxtProgressSnapshot } from '@/services/book/bookConfigService'
import { parseTxtMeta } from '@/services/book/txt/txtParser'
import { BookImportHandler } from '@/services/book/types'

export const txtBookImportHandler: BookImportHandler = {
  async parseMeta({ originalFileName }) {
    return parseTxtMeta(originalFileName)
  },
  buildInitialBookConfig(meta) {
    return {
      name: buildBookTitle(meta.title),
      author: meta.author,
      ...buildTxtProgressSnapshot(0),
    }
  },
}
