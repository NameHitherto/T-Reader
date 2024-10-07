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
import { readFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import ePub from 'epubjs';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

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

    // 监听主程序发送的书籍ID
    listen<string>('load-book-id', (event) => {
      bookId.value = event.payload;
      loadBook();
    }).then((fn) => {
      unlistenBook.value = fn;
    });

    // 监听阅读器窗口关闭
    getCurrentWindow().onCloseRequested(async() => {
      // 保存阅读进度
      if(rendition.value && bookIsReading.value){
        const currentLocation = rendition.value.currentLocation();
        if(currentLocation){
          const cfi = currentLocation.start.cfi;
          // 打开本地配置文件
          const bookConfigData = await readFile(`T-Reader/${bookIsReading.value}.json`, { baseDir: BaseDirectory.Document });
          const bookConfig = JSON.parse(new TextDecoder().decode(bookConfigData));

          // 覆写本地配置文件
          bookConfig.location = cfi;
          await invoke('save_file', {filename: `${bookIsReading.value}.json`, contents: JSON.stringify(bookConfig)});
        }
      };
    }).then((fn) => {
      unlistenClosed.value = fn;
    });

    // 告知主程序已准备好接受书籍ID
    getCurrentWebviewWindow().emitTo('main', 'ready-to-receive-book-id');

    const loadBook = async () => {
      if (!bookId.value) {
        setTimeout(loadBook, 500); // 500ms 后再次尝试加载书籍
        return;
      }

      // 自用书籍ID备份
      bookIsReading.value = bookId.value;
      // 书籍加载完毕书籍ID置空，防止浏览器缓存
      bookId.value = null;

      try {
        // 打开本地配置文件
        const bookConfigData = await readFile(`T-Reader/${bookIsReading.value}.json`, { baseDir: BaseDirectory.Document });
        const bookConfig = JSON.parse(new TextDecoder().decode(bookConfigData));
        // 读取书籍信息
        const bookData = await readFile(`T-Reader/${bookIsReading.value}.epub`, { baseDir: BaseDirectory.Document });
        const bookArrayBuffer = bookData.buffer;
        //const bookBlob = new Blob([bookArrayBuffer], { type: 'application/epub+zip' });

        // 解析并呈现 EPUB 内容
        const ePubBook = ePub(bookArrayBuffer);

        // 清空阅读器内容
        document.getElementById('epub-reader')!.innerHTML = '';

        rendition.value = ePubBook.renderTo('epub-reader', { width: '100%', height: '100%', flow: 'scrolled', allowScriptedContent: true });

        // 恢复阅读进度
        const savedLocation = bookConfig.location;

        if(savedLocation){
          rendition.value.display(savedLocation);
        }else{
          rendition.value.display();
        }

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

    onMounted(async () => {
    });

    onUnmounted(() => {
    });

    return {
      bookId,
      nextPage,
      prevPage,
      bookIsReading,
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
  background-color: rgba(240, 240, 240, 0.85); /* 浅色背景 */
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