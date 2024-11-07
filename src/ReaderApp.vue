<template>
  <div class="reader">
    <!-- EPUB 阅读器内容 -->
    <div id="epub-reader"></div>
    <!-- 翻页按钮 -->
    <div class="pagination">
      <button class="prev-page" @click="prevPage"><font-awesome-icon icon="fa-solid fa-less-than"/></button>
      <button class="next-page" @click="nextPage"><font-awesome-icon icon="fa-solid fa-greater-than"/></button>
    </div>
  </div>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { readFile, BaseDirectory, writeFile } from "@tauri-apps/plugin-fs";
import ePub from 'epubjs';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useReaderConfigStore } from './store/readerConfigStore';
import { storeToRefs } from 'pinia';

export default {
  name: 'ReaderApp',
  setup() {
    // 阅读时书籍ID
    const bookIsReading = ref<string | null>(null);
    // 加载时书籍ID
    const bookId = ref<string | null>(null);
    // 用于存储EPUB渲染对象
    const rendition = ref<any>(null);
    // 用于存储解除监听函数
    let unlistenBook = ref<UnlistenFn | null>(null);
    // 用于存储解除监听函数
    let unlistenClosed = ref<UnlistenFn | null>(null);
    // 用于存储解除监听函数
    let unlistenStyle = ref<UnlistenFn | null>(null);
    // 正式全局变量
    const readerConfigStore = useReaderConfigStore();
    // 全局状态变量，但只能访问不能修改
    const {readerConfig} = storeToRefs(readerConfigStore);

    // 加载或更新阅读器样式
    const applyReaderStyle = async () => {
      // 背景颜色
      document.body.style.backgroundColor = readerConfig.value.color;
      if(readerConfig.value.color === '#000000'){
        // 图标颜色反转
        document.querySelectorAll('img').forEach((img) => {
          img.style.filter = 'invert(1)';
        });
        // 按钮悬浮效果,根据类名选择
        document.querySelectorAll('.titlebar-front-button').forEach((button) => {
          button.classList.add('dark');
        });
        document.querySelectorAll('.titlebar-button').forEach((button) => {
          button.classList.add('dark');
        });
      }else{
        document.querySelectorAll('img').forEach((img) => {
          img.style.filter = 'invert(0)';
        });
        document.querySelectorAll('.titlebar-front-button').forEach((button) => {
          button.classList.remove('dark');
        });
        document.querySelectorAll('.titlebar-button').forEach((button) => {
          button.classList.remove('dark');
        });
      }

      // 阅读器样式
      rendition.value.themes.default({
        "body":{
          "font-family": `${readerConfig.value.font}`,
          "font-size": `${readerConfig.value.fontSize}px`,
          "font-weight": readerConfig.value.fontWeight,
          "padding-left": `${readerConfig.value.firstLineMargin}px !important`,
          "padding-right": `${readerConfig.value.lastLineMargin}px !important`,
          "padding-top": `${readerConfig.value.headerMargin}px !important`,
          "padding-bottom": `${readerConfig.value.footerMargin}px !important`,
        },
        "p":{
          "color": `${readerConfig.value.fontColor}`,
          "line-height": `${readerConfig.value.lineSpacing}em`,
          "margin-bottom": `${readerConfig.value.paragraphSpacing}em`,
          "text-indent": `${readerConfig.value.indent}em`,
        }
      })
    }

    // 读取配置文件
    const loadReaderConfig = async () => {
      try{
        const configData = await readFile('T-Reader/ReaderConfig.json', {baseDir: BaseDirectory.Document});
        const configTemp = JSON.parse(new TextDecoder().decode(configData));
        readerConfigStore.setReaderConfig(configTemp);
      }catch(e){

      }
    }

    // 保存配置文件
    const saveReaderConfig = async () => {
      await invoke('save_file', {filename: 'ReaderConfig.json', contents: JSON.stringify(readerConfig.value)});
    }

    // 保存阅读进度
    const saveReaderRendition = async () => {
      if (rendition.value && bookIsReading.value) {
        const currentLocation = rendition.value.currentLocation();
        if (currentLocation) {
          const cfi = currentLocation.start.cfi;
          // 配置文件
          let bookConfigData;
          try {
            // 尝试获取云同步配置文件
            const cloudConfigData = await invoke('webdav_get', { filename: `${bookIsReading.value}.json` });
            bookConfigData = new Uint8Array(cloudConfigData as ArrayBufferLike);
            console.log('使用云同步配置文件');
          } catch (e) {
            // 获取云同步配置文件失败，使用本地配置文件
            bookConfigData = await readFile(`T-Reader/${bookIsReading.value}.json`, { baseDir: BaseDirectory.Document });
            console.log('使用本地配置文件');
          }
          const bookConfig = JSON.parse(new TextDecoder().decode(bookConfigData));
          // 覆写本地配置文件
          bookConfig.location = cfi;
          const jsonString = JSON.stringify(bookConfig);
          const jsonUint8Array = new TextEncoder().encode(jsonString);
          await invoke('save_file', { filename: `${bookIsReading.value}.json`, contents: jsonString });
          await invoke('webdav_upload', { filename: `${bookIsReading.value}.json`, contents: Array.from(jsonUint8Array) });
        }
      };
    }

    // 监听主程序发送的书籍ID
    listen<string>('load-book-id', async (event) => {
      // 保存之前的阅读进度
      await saveReaderRendition();
      // 加载新书籍
      bookId.value = event.payload;
      await loadBook();
    }).then((fn) => {
      unlistenBook.value = fn;
    });

    // 监听样式调整
    listen('update-reader-style', async() => {
      await applyReaderStyle();
    }).then((fn) => {
      unlistenStyle.value = fn;
    });

    // 监听阅读器窗口关闭
    getCurrentWindow().onCloseRequested(async() => {
      // 保存阅读进度
      await saveReaderRendition();
      // 保存全局配置
      await saveReaderConfig();
    }).then((fn) => {
      unlistenClosed.value = fn;
    });

    // 告知主程序已准备好接受书籍ID
    getCurrentWebviewWindow().emitTo('main', 'ready-to-receive-book-id');

    // 加载书籍
    const loadBook = async () => {
      if (!bookId.value) {
        setTimeout(loadBook, 500); // 500ms 后再次尝试加载书籍
        return;
      }

      // 防止重复加载
      if(rendition.value){
        return;
      }

      // 自用书籍ID备份
      bookIsReading.value = bookId.value;
      // 书籍加载完毕书籍ID置空，防止浏览器缓存
      bookId.value = null;

      try {
        let bookConfigData;
        try{
          // 尝试获取云同步配置文件
          const cloudConfigData = await invoke('webdav_get', { filename: `${bookIsReading.value}.json` });
          bookConfigData = new Uint8Array(cloudConfigData as ArrayBufferLike);
          console.log('使用云同步配置文件');
        }catch(e){
          // 获取云同步配置文件失败，使用本地配置文件
          bookConfigData = await readFile(`T-Reader/${bookIsReading.value}.json`, { baseDir: BaseDirectory.Document });
          console.log('使用本地配置文件');
        }
        const bookConfig = JSON.parse(new TextDecoder().decode(bookConfigData));

        let bookData;
        try {
          // 尝试读取本地书籍信息
          bookData = await readFile(`T-Reader/${bookIsReading.value}.epub`, { baseDir: BaseDirectory.Document });
          console.log('使用本地书籍信息');
        } catch (e) {
          // 读取本地书籍信息失败，尝试获取云同步文件的 EPUB 资源
          const cloudBookData = await invoke('webdav_get', { filename: `${bookIsReading.value}.epub` });
          bookData = new Uint8Array(cloudBookData as ArrayBufferLike);
          console.log('使用云同步书籍信息');

          // 将云同步文件复制到本地
          await writeFile(`T-Reader/${bookIsReading.value}.epub`, bookData, { baseDir: BaseDirectory.Document });
          console.log('云同步书籍信息已复制到本地');
        }
        const bookArrayBuffer = bookData.buffer;
        //const bookBlob = new Blob([bookArrayBuffer], { type: 'application/epub+zip' });

        // 解析并呈现 EPUB 内容
        const ePubBook = ePub(bookArrayBuffer);

        // 清空阅读器内容
        document.getElementById('epub-reader')!.innerHTML = '';

        rendition.value = ePubBook.renderTo('epub-reader', { width: '100%', height: '100%', manager: 'continuous', flow: 'paginated', spread: 'true', allowScriptedContent: true, script: '../../src/js/iframe.js' });

        // 恢复阅读进度
        const savedLocation = bookConfig.location;

        if(savedLocation){
          rendition.value.display(savedLocation);
        }else{
          rendition.value.display();
        }

        // 应用阅读器样式
        await applyReaderStyle();

      } catch (e) {
        console.log(e);
      }
    };

    // 上一章
    const prevPage = () => {
      if (rendition.value) {
        rendition.value.prev();
      }
    };

    // 下一章
    const nextPage = () => {
      if (rendition.value) {
        rendition.value.next();
      }
    };

    // 监听键盘方向事件
    const keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        prevPage();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextPage();
      }
    };

    onMounted(async () => {
      // 加载阅读器配置
      await loadReaderConfig();

      // 监听键盘事件
      document.addEventListener('keydown', keydownHandler);
      // 监听iframe中的点击事件
      window.addEventListener('message', (event) => {
        if (event.data.type === 'iframe-click') {
          // 如果此时样式菜单已打开，则关闭
          document.getElementById('customer-menu')?.remove();
          const frontButtons = document.getElementsByClassName('titlebar-front-button');
          for (let i = 0; i < frontButtons.length; i++) {
            frontButtons[i].classList.remove('active');
          }
        }
      });
      // 监听iframe中的键盘事件
      window.addEventListener('message', (event) => {
        if (event.data.type === 'iframe-keydown') {
          if (event.data.key === 'ArrowLeft' || event.data.key === 'ArrowUp') {
            prevPage();
          } else if (event.data.key === 'ArrowRight' || event.data.key === 'ArrowDown') {
            nextPage();
          }
        }
      });
    });

    onUnmounted(() => {
    });

    return {
      bookId,
      nextPage,
      prevPage,
      bookIsReading,
      readerConfig,
    };
  }
};
</script>

<style scoped>
.reader {
  width: 100%;
  height: 100%;
}

#epub-reader {
  position: absolute;
  padding: 30px 0px 30px 0px;
  width: 100%;
  height: calc(100vh - 60px);
}

/* 滚动条样式 */ 
#epub-reader :deep(.epub-container){
  overflow-x: hidden !important;
}
#epub-reader :deep(.epub-container)::-webkit-scrollbar{
  width: 12px;
}
#epub-reader :deep(.epub-container)::-webkit-scrollbar-track{
  background: transparent;
}
#epub-reader :deep(.epub-container)::-webkit-scrollbar-thumb{
  background-color: rgb(216, 216, 216); /* 浅色背景 */
  border-radius: 6px;
  background-clip: content-box;
}

.pagination {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: space-between;
  align-items: center;
  pointer-events: none;
}

.pagination button {
  height: 80px;
  background-color: rgba(0, 0, 0, 0.1); /* 浅色背景 */
  color: #585858; 
  border: none;
  border-radius: 6px;
  padding: 10px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: auto;
}

.pagination button:hover {
  opacity: 1;
}

.prev-page {
  position: absolute;
  left: 10px;
}

.next-page {
  position: absolute;
  right: 10px;
}


</style>