import { createApp } from "vue";
import App from "./App.vue";
import AndroidApp from "./android/App.vue";
import { getCurrentWindow } from '@tauri-apps/api/window';
import router from './router';
import androidRouter from './router/android';
import {library} from '@fortawesome/fontawesome-svg-core';
import {FontAwesomeIcon} from '@fortawesome/vue-fontawesome';
import {faBookOpen, faBook, faBookBookmark, faFlask} from '@fortawesome/free-solid-svg-icons';
import {faBookmark} from '@fortawesome/free-regular-svg-icons';
import {faStackOverflow} from '@fortawesome/free-brands-svg-icons';
import { platform } from '@tauri-apps/plugin-os';
import { createPinia } from 'pinia';

// FontAwesome 图标库 https://fontawesome.com/search
library.add(faBookOpen); //book-open
library.add(faBookmark); //bookmark
library.add(faStackOverflow); //stack-overflow
library.add(faBook); //book
library.add(faBookBookmark); //book-bookmark
library.add(faFlask); //flask

// 根据当前平台创建不同实例
const currentPlatform = platform();
if(currentPlatform === 'windows') {
  // windows平台
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
}else if(currentPlatform === 'android'){
  // android平台
  const app = createApp(AndroidApp);
  const pinia = createPinia();
  app.use(pinia);
  app.use(androidRouter);
  app.mount("#app");
  // 隐藏window的titlebar
  const titlebarCustom = document.getElementById('titlebar-custom');
  if (titlebarCustom) {
    titlebarCustom.style.display = 'none';
  }
}else{
  console.error('意料之外的平台!');
}

