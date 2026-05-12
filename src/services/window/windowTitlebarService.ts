import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

/**
 * 绑定自定义标题栏按钮事件。
 *
 * 所有窗口操作（最小化 / 最大化 / 关闭）统一通过 Rust 后端 command 执行，
 * 前端不再直接调用 Tauri window API。
 *
 * 返回一个清理函数，用于在组件卸载或 beforeunload 时解绑事件。
 */
export const bindWindowTitlebarControls = () => {
  const windowLabel = getCurrentWindow().label

  const onMinimize = () => {
    void invoke('window_minimize', { label: windowLabel })
  }
  const onMaximize = () => {
    void invoke('window_toggle_maximize', { label: windowLabel })
  }
  const onClose = () => {
    void invoke('window_close', { label: windowLabel })
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
