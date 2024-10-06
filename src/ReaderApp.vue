<template>
  <div class="reader">
    <!-- EPUB 阅读器内容 -->
    <div id="epub-reader"></div>
    <!-- 翻页按钮 -->
    <div class="pagination">
      <button @click="prevPage">上一页</button>
      <button @click="nextPage">下一页</button>
    </div>
  </div>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { readFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import ePub from 'epubjs';

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

    // 监听主程序发送的书籍ID
    listen<string>('load-book-id', (event) => {
      bookId.value = event.payload;
      loadBook();
    }).then((fn) => {
      unlistenBook.value = fn;
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
        // 读取书籍信息
        const bookData = await readFile(`T-Reader/${bookIsReading.value}.epub`, { baseDir: BaseDirectory.Document });
        const bookArrayBuffer = bookData.buffer;
        //const bookBlob = new Blob([bookArrayBuffer], { type: 'application/epub+zip' });

        // 解析并呈现 EPUB 内容
        const ePubBook = ePub(bookArrayBuffer);

        console.log(ePubBook);

        console.log('Book loaded:', bookIsReading.value);

        // 清空阅读器内容
        document.getElementById('epub-reader')!.innerHTML = '';

        rendition.value = ePubBook.renderTo('epub-reader', { width: '100%', height: '100%', flow: 'scrolled', allowScriptedContent: true });

        rendition.value.display();

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
  width: 100%;
  height: 100%;
}
</style>