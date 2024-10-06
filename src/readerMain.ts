import { createApp } from 'vue';
import ReaderApp from './ReaderApp.vue';
import { getCurrentWindow } from '@tauri-apps/api/window';

createApp(ReaderApp).mount('#reader-app');
// 自定义Titlebar
const appWindow = getCurrentWindow();

document
  .getElementById('titlebar-minimize')
  ?.addEventListener('click', () => appWindow.minimize());
document
  .getElementById('titlebar-maximize')
  ?.addEventListener('click', () => appWindow.toggleMaximize());
document
  .getElementById('titlebar-close')
  ?.addEventListener('click', () => appWindow.close());