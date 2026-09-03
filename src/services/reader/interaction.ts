import { READER_DOM_EVENTS } from '@/constants/events'
import { BOOKMARK_UNDERLINE_CLASS } from './bookmarkStyle'
import type { EpubContentsLike, EpubRenditionLike } from '@/services/reader/epubTypes'

interface ReaderKeydownHandlers {
  onPrevPage: () => void
  onNextPage: () => void
  onToggleFullscreen: () => void
}

interface ResetReaderTransientUiHandlers {
  hideContextMenu: () => void
  hideAnnotationBubble?: () => void
}

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
  hideAnnotationBubble?: () => void
  isParentPointerIgnored: (target: HTMLElement | null) => boolean
  openContextMenu: (x: number, y: number, menuItems: ReaderContextMenuItem[]) => void
  buildContextMenuItems: () => ReaderContextMenuItem[]
  buildBookmarkContextMenuItems: (markId: string) => ReaderContextMenuItem[]
  /** 是否有弹窗/菜单正在打开；为 true 时忽略阅读器快捷键，避免干扰弹窗内操作 */
  isOverlayOpen: () => boolean
}

interface ReaderInteractionBinding {
  dispose: () => void
}

export const dispatchReaderKeydown = (event: KeyboardEvent, handlers: ReaderKeydownHandlers) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    handlers.onPrevPage()
    return
  }

  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    handlers.onNextPage()
    return
  }

  if (event.key === 'F11') {
    handlers.onToggleFullscreen()
  }
}

export const resetReaderTransientUi = (handlers: ResetReaderTransientUiHandlers) => {
  window.dispatchEvent(new CustomEvent(READER_DOM_EVENTS.CLOSE_STYLE_MENU))
  handlers.hideContextMenu()
  handlers.hideAnnotationBubble?.()
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
    if (event.key === 'Escape') {
      resetTransientUi()
      return
    }

    // 弹窗/菜单打开时（如书籍信息、绘画、目录、笔记编辑等），
    // 临时禁用方向键翻页等阅读器快捷键，避免干扰弹窗内的输入与操作
    if (args.isOverlayOpen()) {
      return
    }

    dispatchReaderKeydown(event, {
      onPrevPage: args.onPrevPage,
      onNextPage: args.onNextPage,
      onToggleFullscreen: args.onToggleFullscreen,
    })
  }

  const resetTransientUi = () => {
    resetReaderTransientUi({
      hideContextMenu: args.hideContextMenu,
      hideAnnotationBubble: args.hideAnnotationBubble,
    })
  }

  const handleParentPointerDown = (event: PointerEvent) => {
    const target = event.target as HTMLElement | null
    if (args.isParentPointerIgnored(target)) {
      return
    }
    resetTransientUi()
  }

  const handleParentContextMenu = (event: MouseEvent) => {
    // SVG 下划线标记渲染在父文档（iframe 之外的覆盖层），iframe 内的 contextmenu
    // 监听无法命中它，因此需要在父文档单独处理已有笔记的右键菜单。
    const target = event.target as HTMLElement | null
    const underlineEl = target?.closest?.(`.${BOOKMARK_UNDERLINE_CLASS}`) as HTMLElement | null
    if (!underlineEl) {
      return
    }

    const markId = underlineEl.dataset.markId
    if (!markId) {
      return
    }

    event.preventDefault()
    args.hideAnnotationBubble?.()
    args.openContextMenu(event.clientX, event.clientY, args.buildBookmarkContextMenuItems(markId))
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

      const targetIframe = findIframeByWindow(contents.window)
      if (!targetIframe) {
        return
      }

      const iframeRect = targetIframe.getBoundingClientRect()
      const menuX = iframeRect.left + event.clientX
      const menuY = iframeRect.top + event.clientY

      // 优先处理：右键点击已有下划线笔记时，展示笔记管理菜单
      const target = event.target as HTMLElement | null
      const underlineEl = target?.closest?.(`.${BOOKMARK_UNDERLINE_CLASS}`) as HTMLElement | null
      if (underlineEl) {
        const markId = underlineEl.dataset.markId
        if (markId) {
          args.openContextMenu(menuX, menuY, args.buildBookmarkContextMenuItems(markId))
        }
        return
      }

      // 否则：右键点击选中文本时，展示添加笔记菜单
      const selection = contents.window.getSelection()
      if (!selection || !isPointerInsideSelection(event, selection)) {
        return
      }

      args.openContextMenu(menuX, menuY, args.buildContextMenuItems())
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
  document.addEventListener('contextmenu', handleParentContextMenu)
  removers.push(() => {
    document.removeEventListener('keydown', handleKeydown)
    document.removeEventListener('pointerdown', handleParentPointerDown)
    document.removeEventListener('contextmenu', handleParentContextMenu)
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
