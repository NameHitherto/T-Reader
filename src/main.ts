import { createApp } from "vue";
import App from "./App.vue";
import { getCurrentWindow } from '@tauri-apps/api/window';
import router from './router';
import {library} from '@fortawesome/fontawesome-svg-core';
import {FontAwesomeIcon} from '@fortawesome/vue-fontawesome';
import {faBookOpen} from '@fortawesome/free-solid-svg-icons';
import {faBookmark} from '@fortawesome/free-regular-svg-icons';
import {faStackOverflow} from '@fortawesome/free-brands-svg-icons';

// FontAwesome 图标库 https://fontawesome.com/search
library.add(faBookOpen); //book-open
library.add(faBookmark); //bookmark
library.add(faStackOverflow); //stack-overflow

const app = createApp(App);
app.use(router);
app.component('font-awesome-icon', FontAwesomeIcon);
app.mount("#app");

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