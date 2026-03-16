import { createApp } from 'vue';
import ReaderApp from './ReaderApp.vue';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import showStyleMenu from '../src/js/showStyleMenu.ts';
import { createPinia } from 'pinia';
import './css/global.scss';

const app = createApp(ReaderApp);

// 定义pinia
const pinia = createPinia();

app.use(pinia);
app.mount('#reader-app');

// 样式调整菜单
document
  .getElementById('titlebar-customer')
  ?.addEventListener('click', () => showStyleMenu());
// 关于本书信息
document
  .getElementById('titlebar-about')
  ?.addEventListener('click', () => {getCurrentWebviewWindow().emitTo('reader', 'show-book-info')});
// AI助手
document
  .getElementById('titlebar-assistant')
  ?.addEventListener('click', () => {getCurrentWebviewWindow().emitTo('reader', 'show-assistant')});
// 帮助
document
  .getElementById('titlebar-help')
  ?.addEventListener('click', () => {getCurrentWebviewWindow().emitTo('reader', 'show-help')});
document.addEventListener('contextmenu', (event) => {event.preventDefault();});