import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { platform } from '@tauri-apps/plugin-os'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { WINDOW_EVENTS } from '@/constants/events'
import { applyAppThemeMode, initializeAppTheme } from '@/services/theme'
import { bindWindowTitlebarControls } from '@/services/window'
import { logError } from '@/utils/logger'
import { disableBrowserNativeBehaviors } from '@/utils/disableBrowserNativeBehaviors'
import './styles/index.scss'

const bootstrap = async () => {
  await initializeAppTheme()
  disableBrowserNativeBehaviors()

  // 根据当前平台创建不同实例
  const currentPlatform = platform()
  if (currentPlatform === 'windows') {
    // windows平台
    const app = createApp(App)
    app.use(router)
    app.mount('#app')

    const disposeTitlebarControls = bindWindowTitlebarControls()
    const unlistenTheme: UnlistenFn = await listen<{ mode?: string }>(
      WINDOW_EVENTS.UPDATE_APP_THEME,
      (event) => {
        applyAppThemeMode(event.payload?.mode)
      },
    )

    window.addEventListener('beforeunload', () => {
      disposeTitlebarControls()
      unlistenTheme()
    })
  } else {
    logError('app', 'unsupported-platform')
  }
}

void bootstrap()
