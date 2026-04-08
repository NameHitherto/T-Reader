import { BookMark } from '@/store/bookMark'
import { getAppThemePalette, getAppliedAppThemeMode } from '@/services/theme/themeService'

export const applyBookmarkHighlight = (
  rendition: any,
  bookMark: BookMark,
  defaultHighlightColor: string
) => {
  if (!rendition) {
    return
  }

  const themePalette = getAppThemePalette(getAppliedAppThemeMode())

  rendition.annotations.remove(bookMark.bookCfi, 'highlight')
  rendition.annotations.add(
    'highlight',
    bookMark.bookCfi,
    { markId: bookMark.id },
    undefined,
    'bookmark-highlight',
    {
      fill: bookMark.color || defaultHighlightColor,
      stroke: bookMark.hasBorder ? themePalette.readerText : 'none',
    }
  )
}

export const addBookmarkHighlight = (
  rendition: any,
  cfiRange: string,
  markId: string,
  defaultHighlightColor: string
) => {
  if (!rendition) {
    return
  }

  rendition.annotations.add(
    'highlight',
    cfiRange,
    { markId },
    undefined,
    'bookmark-highlight',
    {
      fill: defaultHighlightColor,
    }
  )
}

export const removeBookmarkHighlight = (rendition: any, cfiRange: string) => {
  if (!rendition) {
    return
  }

  rendition.annotations.remove(cfiRange, 'highlight')
}

export const initBookMarksForBook = (
  rendition: any,
  bookMarks: BookMark[],
  bookKey: string,
  defaultHighlightColor: string
) => {
  if (!rendition) {
    return
  }

  bookMarks.forEach((bookMark) => {
    if (bookMark.bookName === bookKey) {
      applyBookmarkHighlight(rendition, bookMark, defaultHighlightColor)
    }
  })
}
