import { BookConfig, BookFormat, BookProgressSnapshot } from '@/types/book'
import { BookCachePayload } from '@/services/book/bookCacheService'
import { BookLocationsCachePayload } from '@/services/book/bookLocationsCacheService'
import { isUnreadProgressSnapshot } from '@/services/book/bookConfigService'
import { ReaderProgressHandler } from '@/services/reader/formatTypes'
import { epubReaderProgressHandler } from '@/services/reader/epub/epubProgressService'
import { txtReaderProgressHandler } from '@/services/reader/txt/txtProgressService'

interface SerializeReaderProgressArgs {
  format: BookFormat
  rendition: any
  txtCurrentParagraph: number
}

const READER_PROGRESS_HANDLERS: Record<BookFormat, ReaderProgressHandler> = {
  epub: epubReaderProgressHandler,
  txt: txtReaderProgressHandler,
}

export const getReaderProgressHandler = (format: BookFormat): ReaderProgressHandler => {
  return READER_PROGRESS_HANDLERS[format]
}

export const serializeReaderProgress = async (
  args: SerializeReaderProgressArgs
): Promise<BookProgressSnapshot | null> => {
  const handler = getReaderProgressHandler(args.format)
  return await handler.serializeProgress({
    rendition: args.rendition,
    txtCurrentParagraph: args.txtCurrentParagraph,
  })
}

export const resolveReaderDisplayTarget = async (
  format: BookFormat,
  source: any,
  snapshot: BookProgressSnapshot
): Promise<string | number | undefined> => {
  return await getReaderProgressHandler(format).resolveDisplayTarget(source, snapshot)
}

export const calculateShelfProgress = async (
  format: BookFormat,
  bookData: Uint8Array | undefined,
  snapshot: BookProgressSnapshot,
  cache: BookCachePayload,
  locationsCache?: BookLocationsCachePayload | null
): Promise<number> => {
  if (isUnreadProgressSnapshot(snapshot)) {
    return 0
  }

  return await getReaderProgressHandler(format).calculateShelfProgress({
    bookData,
    snapshot,
    cache,
    locationsCache,
  })
}

export const isNormalizedProgressSnapshot = (
  value: Partial<BookConfig>
): value is BookProgressSnapshot => {
  return (
    typeof value.durChapterIndex === 'number' &&
    typeof value.durChapterPos === 'number' &&
    typeof value.durChapterTitle === 'string' &&
    typeof value.durChapterTime === 'number'
  )
}
