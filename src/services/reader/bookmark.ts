import type { BookMark } from '@/services/book/types'
import {
  BOOKMARK_UNDERLINE_CLASS,
  DEFAULT_UNDERLINE_STYLE,
  type UnderlineStyle,
} from '@/constants/bookmark'
import type { EpubRenditionLike } from '@/services/reader/epubTypes'

const resolveStyle = (bookMark: BookMark, fallback: UnderlineStyle): UnderlineStyle => ({
  color: bookMark.underlineColor || fallback.color,
  type: bookMark.underlineType || fallback.type,
  width: bookMark.underlineWidth ?? fallback.width,
})

export const applyBookmarkUnderline = (
  rendition: EpubRenditionLike | null,
  bookMark: BookMark,
  defaultStyle: UnderlineStyle,
) => {
  if (!rendition) {
    return
  }

  const style = resolveStyle(bookMark, defaultStyle)

  rendition.annotations.remove(bookMark.bookCfi, 'underline')
  rendition.annotations.add(
    'underline',
    bookMark.bookCfi,
    { markId: bookMark.id },
    undefined,
    BOOKMARK_UNDERLINE_CLASS,
    {
      color: style.color,
      type: style.type,
      width: String(style.width),
    },
  )
}

export const addBookmarkUnderline = (
  rendition: EpubRenditionLike | null,
  cfiRange: string,
  markId: string,
  defaultStyle: UnderlineStyle,
) => {
  if (!rendition) {
    return
  }

  rendition.annotations.add(
    'underline',
    cfiRange,
    { markId },
    undefined,
    BOOKMARK_UNDERLINE_CLASS,
    {
      color: defaultStyle.color,
      type: defaultStyle.type,
      width: String(defaultStyle.width),
    },
  )
}

export const removeBookmarkUnderline = (rendition: EpubRenditionLike | null, cfiRange: string) => {
  if (!rendition) {
    return
  }

  rendition.annotations.remove(cfiRange, 'underline')
}

export const initBookMarksForBook = (
  rendition: EpubRenditionLike | null,
  bookMarks: BookMark[],
  bookKey: string,
  defaultStyle: UnderlineStyle = DEFAULT_UNDERLINE_STYLE,
) => {
  if (!rendition) {
    return
  }

  bookMarks.forEach((bookMark) => {
    if (bookMark.bookName === bookKey) {
      applyBookmarkUnderline(rendition, bookMark, defaultStyle)
    }
  })
}
