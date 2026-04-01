import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';

export const bindWindowTitlebarControls = () => {
  const appWindow = getCurrentWindow();

  // 处理最大化窗口
  const toggleMaximize = async () => {
    const isFullScreen = await appWindow.isFullscreen()
    // 退出全屏
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
    toggleMaximize()
  }
  const onClose = async () => {
    if (appWindow.label === 'reader') {
      await invoke('close_reader_window').catch(() => appWindow.close())
      return
    }

    appWindow.close()
  }

  document
    .getElementById('titlebar-minimize')
    ?.addEventListener('click', onMinimize)
  document
    .getElementById('titlebar-maximize')
    ?.addEventListener('click', onMaximize)
  document
    .getElementById('titlebar-close')
    ?.addEventListener('click', onClose)

  return () => {
    document
      .getElementById('titlebar-minimize')
      ?.removeEventListener('click', onMinimize)
    document
      .getElementById('titlebar-maximize')
      ?.removeEventListener('click', onMaximize)
    document
      .getElementById('titlebar-close')
      ?.removeEventListener('click', onClose)
  }
}