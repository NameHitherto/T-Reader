import { EpubCFI } from 'libs/epub.js'
import type { BookMark } from '@/store/bookMark'
import type { EpubContentsLike } from '@/types/epub'

/**
 * 判断两个同文档 Range 是否相交（含部分相交、包含与被包含、完全相等）。
 * 相邻但不重叠的选区视为不相交。
 */
const rangesOverlap = (a: Range, b: Range): boolean =>
  !(
    a.compareBoundaryPoints(Range.END_TO_START, b) <= 0 ||
    a.compareBoundaryPoints(Range.START_TO_END, b) >= 0
  )

/**
 * 在已有笔记中查找与当前选区重叠的笔记。
 * 仅比较同一章节（spinePos 相同）的笔记，跨章节笔记直接跳过。
 * 返回 null 表示选区未与任何已有笔记重叠。
 */
export const findOverlappingNote = (
  contents: EpubContentsLike,
  selectionRange: Range,
  notes: BookMark[],
): BookMark | null => {
  const selectionCfi = contents.cfiFromRange?.(selectionRange)
  if (!selectionCfi) {
    return null
  }

  const selectionSection = new EpubCFI(selectionCfi).spinePos

  for (const note of notes) {
    if (!note.bookCfi) {
      continue
    }

    if (new EpubCFI(note.bookCfi).spinePos !== selectionSection) {
      continue
    }

    const noteRange = contents.range?.(note.bookCfi)
    if (noteRange && rangesOverlap(selectionRange, noteRange)) {
      return note
    }
  }

  return null
}
