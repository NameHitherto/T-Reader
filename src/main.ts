import { createApp } from "vue";
import App from "./App.vue";
import { getCurrentWindow } from '@tauri-apps/api/window';
import router from './router';

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