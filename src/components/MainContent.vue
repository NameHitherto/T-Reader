<template>
  <div class="main-content">
    <header class="header">
      <span style="font-size: large; font-weight: 600;">全部图书</span>
      <button class="button" @click="addBook">
        <div class="icon">
          <span class="text-icon hide">ePub</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
            <path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 144L48 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l144 0 0 144c0 17.7 14.3 32 32 32s32-14.3 32-32l0-144 144 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-144 0 0-144z"/>
          </svg>
        </div>
      </button>
    </header>
    <div class="book-list">
      <div class="book-header">
        <span>封面</span>
        <span>书名</span>
        <span>作者</span>
        <span>语言</span>
        <span>大小</span>
        <span>上次阅读时间</span>
        <span>加入时间</span>
      </div>
      <div class="book-item" v-for="book in books" :key="book.id" @dblclick="openBook(book.id)" @contextmenu="onContextMenu($event, book.id)">
        <span><img :src="book.cover" alt="封面" /></span>
        <span>{{ book.title }}</span>
        <span>{{ book.author }}</span>
        <span>{{ book.language }}</span>
        <span>{{ book.size }}</span>
        <span>{{ book.lastRead }}</span>
        <span>{{ book.added }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { ref, onMounted } from 'vue';
import ePub from 'epubjs';
import { invoke } from '@tauri-apps/api/core';
import { readFile, writeFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { open } from '@tauri-apps/plugin-dialog';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import '../css/Coolbutton.css';
import '../js/iconfont.js';
import ContextMenu from '@imengyu/vue3-context-menu';

interface Book {
  id: number;
  cover: string;
  title: string;
  author: string;
  language: string;
  size: string;
  lastRead: string;
  added: string;
  path: string;
  location: string;
}

export default {
  name: 'MainContent',
  setup() {
    const fileInput = ref<HTMLInputElement | null>(null);
    const books = ref<Book[]>([]);
    let unlistenReady = ref<UnlistenFn | null>(null);

    const loadBooks = async () => {
      try {
        const loadedBooks: Book[] = await invoke('load_books');
        for (const book of loadedBooks) {
          try {
            const solidBook = await readFile(`T-Reader/${book.id}.epub`, { baseDir: BaseDirectory.Document });
            const arrayBuffer = solidBook.buffer;
            const epub = ePub(arrayBuffer);
            const cover = await epub.coverUrl();
            book.cover = cover ?? 'unknown';
            // 正常添加该书籍
            books.value.push(book);
          } catch (error) {
            console.error('Error loading cover for book:', book.title, error);
          }
        }
      } catch (error) {
        console.error('Error loading books:', error);
      }
    };

    const addBook = async () => {
      const selectedFilePath = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: 'ePub files',
            extensions: ['epub']
          }
        ]
      });

      if (Array.isArray(selectedFilePath) || selectedFilePath === null) {
        return;
      }

      if (books.value.find(book => book.path === selectedFilePath)) {
        console.log("该文件已经添加过了");
        return;
      }

      const u8File: Uint8Array = await invoke('read_file_by_path', { filepath: selectedFilePath });
      const bufferFile = new Uint8Array(u8File).buffer;
      const file = new Blob([bufferFile], { type: 'application/epub+zip' });

      const newBookId = Date.now();
      const newBookPath = `T-Reader/${newBookId}.epub`;
      const contents = new Uint8Array(bufferFile);

      // 上传到云服务器
      invoke('webdav_upload', {
        filename: `${newBookId}.epub`,
        contents: contents
      });

      await writeFile(newBookPath, contents, { baseDir: BaseDirectory.Document });

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const book = ePub(e.target?.result as ArrayBuffer);
          const metadata = await book.loaded.metadata;
          const cover = await book.coverUrl();

          const newBook: Book = {
            id: newBookId,
            cover: cover ?? 'unknown',
            title: metadata.title,
            author: metadata.creator,
            language: metadata.language,
            size: (file.size / 1024 / 1024).toFixed(2) + 'MB',
            lastRead: new Date().toLocaleDateString(),
            added: new Date().toLocaleDateString(),
            path: selectedFilePath,
            location: '0'
          };

          await invoke('save_file', {
            filename: `${newBook.id}.json`,
            contents: JSON.stringify(newBook)
          });

          books.value.push(newBook);

          // 上传到webDAV服务器中
          invoke('webdav_upload', {
            filename: `${newBook.id}.json`,
            contents: new TextEncoder().encode(JSON.stringify(newBook))
          });
        } catch (error) {
          console.error('Error reading or saving the file:', error);
        }
      };
      reader.readAsArrayBuffer(file);
    };

    const deleteBook = async (id: number) => {
      try {
        await invoke('delete_book', { filename: `${id}.json` });
        await invoke('delete_book', { filename: `${id}.epub` });
        await invoke('webdav_delete', { filename: `${id}.json` });
        await invoke('webdav_delete', { filename: `${id}.epub` });
        books.value = books.value.filter(book => book.id !== id);
      } catch (error) {
        console.error('Error deleting the book:', error);
      }
    };

    const openBook = (id: number) => {
      console.log('Opening book:', id);

      const webview = new WebviewWindow('reader', {
        url: 'reader.html',
        title: 'T-Reader',
        decorations: false,
        minHeight: 600,
        minWidth: 600,
      });

      webview.once('tauri://created', async function () {
        // 先移除相同的监听器
        unlistenReady.value?.();
        // 等待阅读器准备好接受书籍ID
        unlistenReady.value = await listen<string>('ready-to-receive-book-id', async () => {
          console.log('Reader is ready to receive book ID');
          WebviewWindow.getCurrent().emitTo('reader', 'load-book-id', id.toString());
        });

      });

      webview.once('tauri://error', function () {
        // 阅读器已加载，此时只需要发送新的书籍ID
        WebviewWindow.getCurrent().emitTo('reader', 'load-book-id', id.toString());
      });
    };

    // 右键菜单
    const onContextMenu = (e: MouseEvent, bookId: number) => {
      e.preventDefault();
      ContextMenu.showContextMenu({
        theme: 'default',
        x: e.x,
        y: e.y,
        items: [
          { 
            label: "打开", 
            svgIcon: '#icon-arrow-double-right',
            onClick: () => openBook(bookId)
          },
          { 
            label: "删除", 
            svgIcon: '#icon-ashbin',
            onClick: () => deleteBook(bookId)
          },
          {
            label: "信息",
            svgIcon: '#icon-prompt-filling',
            // 尚未完成，暂时只打印ID
            onClick: () => console.log('Info:', bookId)
          }
        ]
      });
    };

    onMounted(() => {
      loadBooks();
    });

    return {
      fileInput,
      books,
      addBook,
      deleteBook,
      openBook,
      onContextMenu
    };
  }
};
</script>

<style scoped>
.main-content {
  flex: 1;
  padding: 20px;
  overflow: hidden;
  user-select: none;
}

.header {
  display: flex;
  align-items: center;
  margin: 10px 0 10px 0;
  gap: 10px;
}

.book-list {
  display: flex;
  flex-direction: column;
  overflow-y: scroll;
  height: calc(100vh - 110px);
}

.book-list::-webkit-scrollbar{
  width: 6px;
}
.book-list::-webkit-scrollbar-thumb{
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}
.book-list::-webkit-scrollbar-track{
  background-color: transparent;
}

.book-header,
.book-item {
  display: grid;
  /* 1fr表示它将占据剩余的空间，而不是固定的大小。 */
  grid-template-columns: 50px 1fr 100px 50px 60px 90px 80px;
  gap: 10px;
  padding: 10px 0;
}

.book-item:hover{
  background: rgba(0, 0, 0, 0.15);
}

.book-header span,
.book-item span {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.book-header {
  font-weight: bold;
  border-bottom: 2px solid #ccc;
}

.book-item {
  border-bottom: 1px solid #eee;
}

.book-item span img {
  width: 50px;
  height: auto;
}

</style>