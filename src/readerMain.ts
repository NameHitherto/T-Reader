import { createApp } from 'vue'
import ReaderApp from './ReaderApp.vue'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { READER_DOM_EVENTS, WINDOW_EVENTS } from '@/constants/events'
import { applyAppThemeMode, initializeAppTheme } from '@/services/theme'
import { bindWindowTitlebarControls } from '@/services/window'
import { disableBrowserNativeBehaviors } from '@/utils/disableBrowserNativeBehaviors'
import './styles/index.scss'

const bootstrap = async () => {
  await initializeAppTheme()
  disableBrowserNativeBehaviors()

  const app = createApp(ReaderApp)

  app.mount('#reader-app')

  const disposeTitlebarControls = bindWindowTitlebarControls()
  const webviewWindow = getCurrentWebviewWindow()
  const unlistenTheme: UnlistenFn = await listen<{ mode?: string }>(
    WINDOW_EVENTS.UPDATE_APP_THEME,
    (event) => {
      applyAppThemeMode(event.payload?.mode)
    },
  )

  const onStyleMenuClick = () => {
    window.dispatchEvent(new CustomEvent(READER_DOM_EVENTS.TOGGLE_STYLE_MENU))
  }
  const onDrawDialogClick = () => {
    window.dispatchEvent(new CustomEvent(READER_DOM_EVENTS.TOGGLE_DRAW_DIALOG))
  }
  const onChatDialogClick = () => {
    window.dispatchEvent(new CustomEvent(READER_DOM_EVENTS.TOGGLE_CHAT_DIALOG))
  }
  const onSearchDialogClick = () => {
    window.dispatchEvent(new CustomEvent(READER_DOM_EVENTS.TOGGLE_SEARCH_DIALOG))
  }
  const onShowBookInfoClick = () => {
    webviewWindow.emit(WINDOW_EVENTS.SHOW_BOOK_INFO)
  }
  const onShowHelpClick = () => {
    webviewWindow.emit(WINDOW_EVENTS.SHOW_HELP)
  }

  // 样式调整菜单
  document.getElementById('titlebar-customer')?.addEventListener('click', onStyleMenuClick)
  // AI绘画弹窗
  document.getElementById('titlebar-draw')?.addEventListener('click', onDrawDialogClick)
  document.getElementById('titlebar-chat')?.addEventListener('click', onChatDialogClick)
  // 书籍内容搜索
  document.getElementById('titlebar-search')?.addEventListener('click', onSearchDialogClick)
  // 关于本书信息
  document.getElementById('titlebar-about')?.addEventListener('click', onShowBookInfoClick)
  // 帮助
  document.getElementById('titlebar-help')?.addEventListener('click', onShowHelpClick)

  window.addEventListener('beforeunload', () => {
    document.getElementById('titlebar-customer')?.removeEventListener('click', onStyleMenuClick)
    document.getElementById('titlebar-draw')?.removeEventListener('click', onDrawDialogClick)
    document.getElementById('titlebar-chat')?.removeEventListener('click', onChatDialogClick)
    document.getElementById('titlebar-search')?.removeEventListener('click', onSearchDialogClick)
    document.getElementById('titlebar-about')?.removeEventListener('click', onShowBookInfoClick)
    document.getElementById('titlebar-help')?.removeEventListener('click', onShowHelpClick)
    unlistenTheme()
    disposeTitlebarControls()
  })
}

void bootstrap()
