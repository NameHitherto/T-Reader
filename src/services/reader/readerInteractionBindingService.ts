import type { EpubContentsLike, EpubRenditionLike } from '@/types/epub'
import { dispatchReaderKeydown, resetReaderTransientUi } from '@/services/reader/interactionService'

interface ReaderContextMenuItem {
  label: string
  type?: string
  onClick?: () => void
}

interface BindReaderInteractionsArgs {
  onPrevPage: () => void
  onNextPage: () => void
  onToggleFullscreen: () => void
  hideContextMenu: () => void
  isParentPointerIgnored: (target: HTMLElement | null) => boolean
  openContextMenu: (x: number, y: number, menuItems: ReaderContextMenuItem[]) => void
  buildContextMenuItems: () => ReaderContextMenuItem[]
}

interface ReaderInteractionBinding {
  dispose: () => void
}

const findIframeByWindow = (iframeWindow: Window) => {
  const iframes = document.querySelectorAll('iframe')

  for (let i = 0; i < iframes.length; i++) {
    const iframe = iframes[i] as HTMLIFrameElement
    if (iframe.contentWindow === iframeWindow) {
      return iframe
    }
  }

  return null
}

const isPointerInsideSelection = (event: MouseEvent, selection: Selection) => {
  if (selection.rangeCount === 0 || !selection.toString()) {
    return false
  }

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()

  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  )
}

export const bindReaderInteractions = (
  rendition: EpubRenditionLike | null,
  args: BindReaderInteractionsArgs,
): ReaderInteractionBinding => {
  const removers: Array<() => void> = []
  const boundDocuments = new WeakSet<Document>()

  const handleKeydown = (event: KeyboardEvent) => {
    dispatchReaderKeydown(event, {
      onPrevPage: args.onPrevPage,
      onNextPage: args.onNextPage,
      onToggleFullscreen: args.onToggleFullscreen,
    })
  }

  const resetTransientUi = () => {
    resetReaderTransientUi({
      hideContextMenu: args.hideContextMenu,
    })
  }

  const handleParentPointerDown = (event: PointerEvent) => {
    const target = event.target as HTMLElement | null
    if (args.isParentPointerIgnored(target)) {
      return
    }
    resetTransientUi()
  }

  const bindIframeDocument = (contents: EpubContentsLike) => {
    const contentDocument = contents?.document
    if (!contentDocument || boundDocuments.has(contentDocument)) {
      return
    }

    boundDocuments.add(contentDocument)

    const handleIframePointerDown = () => {
      resetTransientUi()
    }

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()

      const selection = contents.window.getSelection()
      if (!selection || !isPointerInsideSelection(event, selection)) {
        return
      }

      const targetIframe = findIframeByWindow(contents.window)
      if (!targetIframe) {
        return
      }

      const iframeRect = targetIframe.getBoundingClientRect()
      args.openContextMenu(
        iframeRect.left + event.clientX,
        iframeRect.top + event.clientY,
        args.buildContextMenuItems(),
      )
    }

    contentDocument.addEventListener('keydown', handleKeydown)
    contentDocument.addEventListener('pointerdown', handleIframePointerDown)
    contentDocument.addEventListener('contextmenu', handleContextMenu)

    removers.push(() => {
      contentDocument.removeEventListener('keydown', handleKeydown)
      contentDocument.removeEventListener('pointerdown', handleIframePointerDown)
      contentDocument.removeEventListener('contextmenu', handleContextMenu)
    })
  }

  const contentHook = (contents: EpubContentsLike) => {
    bindIframeDocument(contents)
    return contents
  }

  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('pointerdown', handleParentPointerDown)
  removers.push(() => {
    document.removeEventListener('keydown', handleKeydown)
    document.removeEventListener('pointerdown', handleParentPointerDown)
  })

  if (rendition) {
    rendition.hooks.content.register(contentHook)
    removers.push(() => {
      rendition.hooks.content.deregister?.(contentHook)
    })

    const renderedContents =
      typeof rendition.getContents === 'function' ? rendition.getContents() : []
    for (const contents of renderedContents) {
      bindIframeDocument(contents)
    }
  }

  return {
    dispose: () => {
      while (removers.length > 0) {
        removers.pop()?.()
      }
    },
  }
}
