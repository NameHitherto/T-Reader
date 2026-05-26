import { READER_DOM_EVENTS } from '@/constants/events'

interface ReaderKeydownHandlers {
  onPrevPage: () => void
  onNextPage: () => void
  onToggleFullscreen: () => void
}

interface ResetReaderTransientUiHandlers {
  hideContextMenu: () => void
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
}
