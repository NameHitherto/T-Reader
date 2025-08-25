import { getCurrentWindow } from '@tauri-apps/api/window';

// 自定义Titlebar
const appWindow = getCurrentWindow();
// 处理最大化窗口
const toggleMaximize = async() => {
  const isFullScreen = await appWindow.isFullscreen()
  // 退出全屏
  if (isFullScreen) {
    await appWindow.setFullscreen(false)
  } else {
    const isMaximized = await appWindow.isMaximized()
    if (isMaximized){
      await appWindow.unmaximize()
    } else {
      await appWindow.maximize()
    }
  }
}

document
  .getElementById('titlebar-minimize')
  ?.addEventListener('click', () => appWindow.minimize());
document
  .getElementById('titlebar-maximize')
  ?.addEventListener('click', () => toggleMaximize());
document
  .getElementById('titlebar-close')
  ?.addEventListener('click', () => appWindow.close());