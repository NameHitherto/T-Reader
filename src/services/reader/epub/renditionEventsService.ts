import type { EpubContentsLike, EpubLocationLike, EpubRenditionLike } from '@/types/epub'

interface ReaderContextMenuItem {
  label: string
  type?: string
  onClick?: () => void
}

interface BindRenditionEventsArgs {
  onRelocated: (location: EpubLocationLike) => void
  onSelected: (cfiRange: string, selectedText: string) => void
  onKeyNavigatePrev: () => void
  onKeyNavigateNext: () => void
  onToggleFullscreen: () => void
  onReaderClick: () => void
  onMarkClicked: (markId: string) => void
  openContextMenu: (x: number, y: number, menuItems: ReaderContextMenuItem[]) => void
  buildContextMenuItems: () => ReaderContextMenuItem[]
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

  rendition.on('keydown', (event: unknown) => {
    if (!(event instanceof KeyboardEvent)) {
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      args.onKeyNavigatePrev()
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      args.onKeyNavigateNext()
    } else if (event.key === 'F11') {
      args.onToggleFullscreen()
    }
  })

  rendition.on('click', () => {
    args.onReaderClick()
  })

  rendition.on('markClicked', (_cfiRange: unknown, data: unknown) => {
    const markId = (data as { markId?: string })?.markId
    if (markId) {
      args.onMarkClicked(markId)
    }
  })

  const boundDocuments = new WeakSet<Document>()

  const bindContextMenuForContents = (contents: EpubContentsLike) => {
    const contentDocument = contents?.document as Document | undefined
    if (!contentDocument || boundDocuments.has(contentDocument)) {
      return
    }

    boundDocuments.add(contentDocument)
    contentDocument.addEventListener('contextmenu', (event: MouseEvent) => {
      event.preventDefault()
      const selection = contents.window.getSelection()
      if (!selection || selection.rangeCount === 0 || !selection.toString()) {
        return
      }

      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        return
      }

      const iframeWindow = contents.window
      let targetIframe: HTMLIFrameElement | null = null
      const iframes = document.querySelectorAll('iframe')

      for (let i = 0; i < iframes.length; i++) {
        const iframe = iframes[i] as HTMLIFrameElement
        if (iframe.contentWindow === iframeWindow) {
          targetIframe = iframe
          break
        }
      }

      if (!targetIframe) {
        return
      }

      const iframeRect = targetIframe.getBoundingClientRect()
      const absoluteX = iframeRect.left + event.clientX
      const absoluteY = iframeRect.top + event.clientY

      args.openContextMenu(absoluteX, absoluteY, args.buildContextMenuItems())
    })
  }

  rendition.hooks.content.register((contents: EpubContentsLike) => {
    bindContextMenuForContents(contents)

    return contents
  })

  const renderedContents =
    typeof rendition.getContents === 'function' ? rendition.getContents() : []
  for (const contents of renderedContents) {
    bindContextMenuForContents(contents)
  }
}
