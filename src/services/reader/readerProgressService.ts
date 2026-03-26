import { BookFormat } from '@/js/bookFormat'
import { BookMark } from '@/store/bookMark'
import { BookConfig } from '@/js/map'
import { loadBookConfig, saveBookConfig } from '@/services/book/bookRepository'

interface SaveReaderProgressArgs {
  bookName: string
  format: BookFormat
  rendition: any
  txtCurrentParagraph: number
  bookMarks: BookMark[]
}

const buildLocationSnapshot = (
  format: BookFormat,
  rendition: any,
  txtCurrentParagraph: number
): string | null => {
  if (format === 'epub') {
    const currentLocation = rendition?.currentLocation?.()
    if (!currentLocation?.start?.cfi) {
      return null
    }

    return currentLocation.start.cfi
  }

  return String(txtCurrentParagraph)
}

export const saveReaderProgress = async (
  args: SaveReaderProgressArgs
): Promise<BookConfig | null> => {
  const { bookName, format, rendition, txtCurrentParagraph, bookMarks } = args
  const location = buildLocationSnapshot(format, rendition, txtCurrentParagraph)

  if (!location) {
    return null
  }

  const bookConfig = await loadBookConfig(bookName)
  bookConfig.location = location

  if (format === 'epub') {
    const nextBookMarks = bookMarks.filter((mark) => mark.bookName === bookName)
    if (nextBookMarks.length > 0) {
      bookConfig.bookMarks = nextBookMarks
    } else {
      delete bookConfig.bookMarks
    }
  }

  await saveBookConfig(bookName, bookConfig)
  return {
    ...bookConfig,
    updatedAt: new Date().toISOString(),
  }
}
