interface ReaderKeydownHandlers {
  onPrevPage: () => void
  onNextPage: () => void
  onToggleFullscreen: () => void
}

export const dispatchReaderKeydown = (
  event: KeyboardEvent,
  handlers: ReaderKeydownHandlers
) => {
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

export const resetReaderTransientUi = (hideContextMenu: () => void) => {
  document.getElementById('customer-menu')?.remove()
  const frontButtons = document.getElementsByClassName('titlebar-front-button')
  for (let i = 0; i < frontButtons.length; i++) {
    frontButtons[i].classList.remove('active')
  }
  hideContextMenu()
}
