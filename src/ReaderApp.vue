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
import { ref, onMounted } from 'vue';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { readFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import ePub from 'epubjs';

export default {
  name: 'ReaderApp',
  setup() {
    const bookId = ref<string | null>(null);
    // 用于存储EPUB渲染对象
    const rendition = ref<any>(null);

    // 监听主程序发送的书籍ID
    listen<string>('load-book-id', (event) => {
      bookId.value = event.payload;
    });

    // 告知主程序已准备好接受书籍ID
    getCurrentWebviewWindow().emitTo('main', 'ready-to-receive-book-id');

    const loadBook = async () => {
      if (!bookId.value) {
        setTimeout(loadBook, 500); // 500ms 后再次尝试加载书籍
        return;
      }

      try {
        // 读取书籍信息
        const bookData = await readFile(`T-Reader/${bookId.value}.epub`, { baseDir: BaseDirectory.Document });
        const bookArrayBuffer = bookData.buffer;
        //const bookBlob = new Blob([bookArrayBuffer], { type: 'application/epub+zip' });

        // 解析并呈现 EPUB 内容
        const ePubBook = ePub(bookArrayBuffer);

        rendition.value = ePubBook.renderTo('epub-reader', { width: '100%', height: '100%', flow: 'scrolled', allowScriptedContent: true });

        rendition.value.display();

      } catch (e) {
        console.log(e);
      }
    };

    const prevPage = () => {
      if (rendition.value) {
        rendition.value.prev();
      }
    };

    const nextPage = () => {
      if (rendition.value) {
        rendition.value.next();
      }
    };

    onMounted(() => {
      loadBook();
    });

    return {
      bookId,
      nextPage,
      prevPage
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