import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

export const bindWindowTitlebarControls = () => {
  const appWindow = getCurrentWindow()

  const toggleMaximize = async () => {
    const isFullScreen = await appWindow.isFullscreen()
    if (isFullScreen) {
      await appWindow.setFullscreen(false)
    } else {
      const isMaximized = await appWindow.isMaximized()
      if (isMaximized) {
        await appWindow.unmaximize()
      } else {
        await appWindow.maximize()
      }
    }
  }

  const onMinimize = () => appWindow.minimize()
  const onMaximize = () => {
    void toggleMaximize()
  }
  const onClose = async () => {
    if (appWindow.label === 'reader') {
      await invoke('close_reader_window').catch(() => appWindow.close())
      return
    }

    appWindow.close()
  }

  document.getElementById('titlebar-minimize')?.addEventListener('click', onMinimize)
  document.getElementById('titlebar-maximize')?.addEventListener('click', onMaximize)
  document.getElementById('titlebar-close')?.addEventListener('click', onClose)

  return () => {
    document.getElementById('titlebar-minimize')?.removeEventListener('click', onMinimize)
    document.getElementById('titlebar-maximize')?.removeEventListener('click', onMaximize)
    document.getElementById('titlebar-close')?.removeEventListener('click', onClose)
  }
}
