import { createApp } from 'vue';
import ReaderApp from './ReaderApp.vue';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { createPinia } from 'pinia';
import { READER_DOM_EVENTS, WINDOW_EVENTS } from '@/constants/events';
import { bindWindowTitlebarControls } from './js/init';
import { applyAppThemeMode, initializeAppTheme } from '@/services/theme/themeService';
import { initAppLogger } from '@/utils/logger';
import './styles/index.scss';

const bootstrap = async () => {
  await initializeAppTheme();
  await initAppLogger('reader');

  const app = createApp(ReaderApp);

  // 定义pinia
  const pinia = createPinia();

  app.use(pinia);
  app.mount('#reader-app');

  const disposeTitlebarControls = bindWindowTitlebarControls();
  const webviewWindow = getCurrentWebviewWindow();
  const unlistenTheme: UnlistenFn = await listen<{ mode?: string }>(
    WINDOW_EVENTS.UPDATE_APP_THEME,
    (event) => {
      applyAppThemeMode(event.payload?.mode);
    }
  );

  const onStyleMenuClick = () => {
    window.dispatchEvent(new CustomEvent(READER_DOM_EVENTS.TOGGLE_STYLE_MENU));
  };
  const onShowBookInfoClick = () => {
    webviewWindow.emit(WINDOW_EVENTS.SHOW_BOOK_INFO);
  };
  const onShowAssistantClick = () => {
    webviewWindow.emit(WINDOW_EVENTS.SHOW_ASSISTANT);
  };
  const onShowHelpClick = () => {
    webviewWindow.emit(WINDOW_EVENTS.SHOW_HELP);
  };
  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  // 样式调整菜单
  document
    .getElementById('titlebar-customer')
    ?.addEventListener('click', onStyleMenuClick);
  // 关于本书信息
  document
    .getElementById('titlebar-about')
    ?.addEventListener('click', onShowBookInfoClick);
  // AI助手
  document
    .getElementById('titlebar-assistant')
    ?.addEventListener('click', onShowAssistantClick);
  // 帮助
  document
    .getElementById('titlebar-help')
    ?.addEventListener('click', onShowHelpClick);
  document.addEventListener('contextmenu', onContextMenu);

  window.addEventListener('beforeunload', () => {
    document.getElementById('titlebar-customer')?.removeEventListener('click', onStyleMenuClick);
    document.getElementById('titlebar-about')?.removeEventListener('click', onShowBookInfoClick);
    document.getElementById('titlebar-assistant')?.removeEventListener('click', onShowAssistantClick);
    document.getElementById('titlebar-help')?.removeEventListener('click', onShowHelpClick);
    document.removeEventListener('contextmenu', onContextMenu);
    unlistenTheme();
    disposeTitlebarControls();
  });
};

void bootstrap();
