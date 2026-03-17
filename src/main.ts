import { createApp } from "vue";
import App from "./App.vue";
import router from './router';
import { platform } from '@tauri-apps/plugin-os';
import { bindWindowTitlebarControls } from './js/init';
import './css/global.scss';

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

  document.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('beforeunload', () => {
    disposeTitlebarControls();
    document.removeEventListener('contextmenu', onContextMenu);
  });
}else if(currentPlatform === 'android'){
  // android平台
  console.error('Android平台已不支持!');
}else{
  console.error('意料之外的平台!');
}

