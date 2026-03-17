import { BookFormat } from '@/js/bookFormat'
import { BookMark } from '@/store/bookMark'
import { BookConfig } from '@/js/map'
import { calcTxtProgress } from '@/services/reader/txtReaderService'
import { loadBookConfig, saveBookConfig } from '@/services/book/bookRepository'

interface SaveReaderProgressArgs {
  bookId: string
  format: BookFormat
  rendition: any
  txtCurrentParagraph: number
  txtReaderElement: HTMLElement | null
  bookMarks: BookMark[]
}

const buildProgressSnapshot = (
  format: BookFormat,
  rendition: any,
  txtCurrentParagraph: number,
  txtReaderElement: HTMLElement | null
): { location: string; progress: number } | null => {
  if (format === 'epub') {
    const currentLocation = rendition?.currentLocation?.()
    if (!currentLocation) {
      return null
    }

    return {
      location: currentLocation.start.cfi,
      progress: Number(((currentLocation.start.percentage || 0) * 100).toFixed(2)),
    }
  }

  return {
    location: String(txtCurrentParagraph),
    progress: txtReaderElement
      ? calcTxtProgress(
          txtReaderElement.scrollTop,
          txtReaderElement.scrollHeight,
          txtReaderElement.clientHeight
        )
      : 0,
  }
}

export const saveReaderProgress = async (
  args: SaveReaderProgressArgs
): Promise<BookConfig | null> => {
  const {
    bookId,
    format,
    rendition,
    txtCurrentParagraph,
    txtReaderElement,
    bookMarks,
  } = args

  const snapshot = buildProgressSnapshot(
    format,
    rendition,
    txtCurrentParagraph,
    txtReaderElement
  )

  if (!snapshot) {
    return null
  }

  const bookConfig = await loadBookConfig(bookId)
  bookConfig.lastRead = new Date().toLocaleDateString()
  bookConfig.location = snapshot.location
  bookConfig.progress = snapshot.progress

  if (format === 'epub' && bookMarks.length > 0) {
    bookConfig.bookMarks = bookMarks.filter((mark) => mark.bookId === bookId)
  }

  await saveBookConfig(bookId, bookConfig)
  return bookConfig
}
