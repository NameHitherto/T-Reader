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
    const cfi = typeof cfiRange === 'string' ? cfiRange : ''
    const readerContents = contents as EpubContentsLike
    const selectedText = readerContents.window.getSelection()?.toString() || ''
    args.onSelected(cfi, selectedText)
  })

  rendition.on('markClicked', (_cfiRange: unknown, data: unknown) => {
    const markId = (data as { markId?: string })?.markId
    if (markId) {
      args.onMarkClicked(markId)
    }
  })
}
