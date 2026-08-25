import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { WINDOW_LABELS } from '@/constants'

/**
 * 绑定自定义标题栏按钮事件。
 *
 * 窗口操作统一通过 Rust 后端 command 执行。
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
    if (windowLabel === WINDOW_LABELS.READER) {
      void invoke('hide_reader_window')
      return
    }

    void invoke('app_close')
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
