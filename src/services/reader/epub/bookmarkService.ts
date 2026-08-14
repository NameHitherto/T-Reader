import { BookMark } from '@/store/bookMark'
import { BOOKMARK_HIGHLIGHT_CLASS } from '@/constants/bookmark'
import type { EpubRenditionLike } from '@/types/epub'

export const applyBookmarkHighlight = (
  rendition: EpubRenditionLike | null,
  bookMark: BookMark,
  defaultHighlightColor: string,
) => {
  if (!rendition) {
    return
  }

  rendition.annotations.remove(bookMark.bookCfi, 'highlight')
  rendition.annotations.add(
    'highlight',
    bookMark.bookCfi,
    { markId: bookMark.id },
    undefined,
    BOOKMARK_HIGHLIGHT_CLASS,
    {
      fill: bookMark.color || defaultHighlightColor,
    },
  )
}

export const addBookmarkHighlight = (
  rendition: EpubRenditionLike | null,
  cfiRange: string,
  markId: string,
  defaultHighlightColor: string,
) => {
  if (!rendition) {
    return
  }

  rendition.annotations.add('highlight', cfiRange, { markId }, undefined, BOOKMARK_HIGHLIGHT_CLASS, {
    fill: defaultHighlightColor,
  })
}

export const removeBookmarkHighlight = (rendition: EpubRenditionLike | null, cfiRange: string) => {
  if (!rendition) {
    return
  }

  rendition.annotations.remove(cfiRange, 'highlight')
}

export const initBookMarksForBook = (
  rendition: EpubRenditionLike | null,
  bookMarks: BookMark[],
  bookKey: string,
  defaultHighlightColor: string,
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
