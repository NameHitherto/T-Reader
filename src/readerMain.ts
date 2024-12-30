import { createApp } from 'vue';
import ReaderApp from './ReaderApp.vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import {library} from '@fortawesome/fontawesome-svg-core';
import {FontAwesomeIcon} from '@fortawesome/vue-fontawesome';
import {faGreaterThan, faLessThan} from '@fortawesome/free-solid-svg-icons';
import {} from '@fortawesome/free-regular-svg-icons';
import {} from '@fortawesome/free-brands-svg-icons';
import showStyleMenu from '../src/js/showStyleMenu.ts';
import { createPinia } from 'pinia';
import './css/global.scss';

// FontAwesome 图标库 https://fontawesome.com/search
library.add(faGreaterThan); //greater-than
library.add(faLessThan); //less-than

const app = createApp(ReaderApp);

// 定义pinia
const pinia = createPinia();

app.use(pinia);
app.component('font-awesome-icon', FontAwesomeIcon);
app.mount('#reader-app');

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
// 样式调整菜单
document
  .getElementById('titlebar-customer')
  ?.addEventListener('click', () => showStyleMenu());
// 关于本书信息
document
  .getElementById('titlebar-about')
  ?.addEventListener('click', () => {getCurrentWebviewWindow().emitTo('reader', 'show-book-info')});
document.addEventListener('contextmenu', (event) => {event.preventDefault();});