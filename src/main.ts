import { createApp } from "vue";
import App from "./App.vue";
import router from './router';
import { platform } from '@tauri-apps/plugin-os';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { bindWindowTitlebarControls } from './js/init';
import { WINDOW_EVENTS } from '@/constants/events';
import { applyAppThemeMode, initializeAppTheme } from '@/services/theme/themeService';
import { initAppLogger, logError } from '@/utils/logger';
import './styles/index.scss';

const bootstrap = async () => {
  await initializeAppTheme();
  await initAppLogger('main');

  // 根据当前平台创建不同实例
  const currentPlatform = platform();
  if(currentPlatform === 'windows') {
    // windows平台
    const app = createApp(App);
    app.use(router);
    app.mount("#app");

    const disposeTitlebarControls = bindWindowTitlebarControls();
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };
    const unlistenTheme: UnlistenFn = await listen<{ mode?: string }>(
      WINDOW_EVENTS.UPDATE_APP_THEME,
      (event) => {
        applyAppThemeMode(event.payload?.mode);
      }
    );

    document.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('beforeunload', () => {
      disposeTitlebarControls();
      document.removeEventListener('contextmenu', onContextMenu);
      unlistenTheme();
    });
  }else if(currentPlatform === 'android'){
    // android平台
    logError('bootstrap', 'Android平台已不支持!');
  }else{
    logError('bootstrap', '意料之外的平台!');
  }
};

void bootstrap();

