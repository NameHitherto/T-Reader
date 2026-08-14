import { BOOKMARK_HIGHLIGHT_CLASS } from '@/constants/bookmark'
import type { EpubContentsLike, EpubLocationLike, EpubRenditionLike } from '@/types/epub'

interface BindRenditionEventsArgs {
  onRelocated: (location: EpubLocationLike) => void
  onSelected: (cfiRange: string, selectedText: string) => void
  onMarkClicked: (markId: string) => void
}

export const bindRenditionEvents = (
  rendition: EpubRenditionLike | null,
  args: BindRenditionEventsArgs,
) => {
  if (!rendition) {
    return
  }

  rendition.on('relocated', (location: unknown) => {
    args.onRelocated(location as EpubLocationLike)
  })

  rendition.on('selected', (cfiRange: unknown, contents: unknown) => {
    const readerContents = contents as EpubContentsLike
    const selection = readerContents.window?.getSelection?.()
    const selectedText = selection?.toString() || ''
    let cfi = typeof cfiRange === 'string' ? cfiRange : ''

    // 重新基于选区计算 CFI，并忽略已有高亮包裹 span，确保书签在重新渲染后仍能准确定位。
    if (
      selection &&
      selection.rangeCount > 0 &&
      typeof readerContents.cfiFromRange === 'function'
    ) {
      const recomputed = readerContents.cfiFromRange(
        selection.getRangeAt(0),
        BOOKMARK_HIGHLIGHT_CLASS,
      )
      if (recomputed) {
        cfi = recomputed
      }
    }

    args.onSelected(cfi, selectedText)
  })

  rendition.on('markClicked', (_cfiRange: unknown, data: unknown) => {
    const markId = (data as { markId?: string })?.markId
    if (markId) {
      args.onMarkClicked(markId)
    }
  })
}
