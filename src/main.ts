import { createApp } from "vue";
import App from "./App.vue";
import AndroidApp from "./android/App.vue";
import { getCurrentWindow } from '@tauri-apps/api/window';
import router from './router';
import androidRouter from './router/android';
import { platform } from '@tauri-apps/plugin-os';
import { createPinia } from 'pinia';
import './css/global.scss';

// 根据当前平台创建不同实例
const currentPlatform = platform();
if(currentPlatform === 'windows') {
  // windows平台
  const app = createApp(App);
  app.use(router);
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
  document.addEventListener('contextmenu', (event) => {event.preventDefault();});
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

