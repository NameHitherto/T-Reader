<template>
  <div class="main-content">
    <Transition name="loading">
      <loadingBlockade v-if="isLoading" class="loading" />
    </Transition>
    <header class="header">
      <span style="font-size: large; font-weight: 600">全部图书</span>
      <button class="button" @click="addBook">
        <div class="icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
            <path
              d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 144L48 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l144 0 0 144c0 17.7 14.3 32 32 32s32-14.3 32-32l0-144 144 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-144 0 0-144z"
            />
          </svg>
        </div>
      </button>
      <button class="button" @click="syncFiles">
        <div class="icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            viewBox="0 0 48 48"
          >
            <g
              fill="none"
              stroke="#000"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="4"
            >
              <path d="M42 8V24" />
              <path d="M6 24L6 40" />
              <path
                d="M42 24C42 14.0589 33.9411 6 24 6C18.9145 6 14.3216 8.10896 11.0481 11.5M6 24C6 33.9411 14.0589 42 24 42C28.8556 42 33.2622 40.0774 36.5 36.9519"
              />
            </g>
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
      <div
        class="book-item"
        v-for="book in books"
        :key="book.id"
        @dblclick="openBook(book.id)"
        @contextmenu="onContextMenu($event, book.id)"
      >
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
import { ref, onMounted } from 'vue'
import ePub from 'epubjs'
import { invoke } from '@tauri-apps/api/core'
import { readFile, writeFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { open } from '@tauri-apps/plugin-dialog'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import '../css/Coolbutton.css'
import '../js/iconfont.js'
import ContextMenu from '@imengyu/vue3-context-menu'
import loadingBlockade from './loadingBlockade.vue'

interface Book {
  id: number
  cover: string
  title: string
  author: string
  language: string
  size: string
  lastRead: string
  added: string
  path: string
  location: string
}

export default {
  name: 'MainContent',
  components: {
    loadingBlockade,
  },
  setup() {
    const books = ref<Book[]>([])
    let unlistenReady = ref<UnlistenFn | null>(null)
    const isLoading = ref(false) // 是否正在加载

    const loadBooks = async () => {
      try {
        const loadedBooks: Book[] = await invoke('load_books')
        books.value = []
        for (const book of loadedBooks) {
          try {
            const solidBook = await readFile(`T-Reader/${book.id}.epub`, {
              baseDir: BaseDirectory.Document,
            })
            const arrayBuffer = solidBook.buffer
            const epub = ePub(arrayBuffer)
            const cover = await epub.coverUrl()
            book.cover = cover ?? 'unknown'
            // 正常添加该书籍
            books.value.push(book)
          } catch (error) {
            console.error('Error loading cover for book:', book.title, error)
          }
        }
      } catch (error) {
        console.error('Error loading books:', error)
      }
    }

    const syncFiles = async () => {
      isLoading.value = true
      try {
        await invoke('webdav_sync_files')
        console.log('文件同步成功')
        await loadBooks()
      } catch (error) {
        isLoading.value = false
        console.error('文件同步失败:', error)
      }
      isLoading.value = false
    }

    const addBook = async () => {
      const selectedFilePath = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: 'ePub files',
            extensions: ['epub'],
          },
        ],
      })

      if (Array.isArray(selectedFilePath) || selectedFilePath === null) {
        return
      }

      if (books.value.find((book) => book.path === selectedFilePath)) {
        console.log('该文件已经添加过了')
        return
      }
      isLoading.value = true
      const u8File: Uint8Array = await invoke('read_file_by_path', {
        filepath: selectedFilePath,
      })
      const bufferFile = new Uint8Array(u8File).buffer
      const file = new Blob([bufferFile], { type: 'application/epub+zip' })

      const newBookId = Date.now()
      const newBookPath = `T-Reader/${newBookId}.epub`
      const contents = new Uint8Array(bufferFile)

      // 上传到云服务器
      invoke('webdav_upload', {
        filename: `${newBookId}.epub`,
        contents: contents,
      })

      await writeFile(newBookPath, contents, {
        baseDir: BaseDirectory.Document,
      })

      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const book = ePub(e.target?.result as ArrayBuffer)
          const metadata = await book.loaded.metadata
          const cover = await book.coverUrl()

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
            location: '0',
          }

          await invoke('save_file', {
            filename: `${newBook.id}.json`,
            contents: JSON.stringify(newBook),
          })

          books.value.push(newBook)

          // 上传到webDAV服务器中
          invoke('webdav_upload', {
            filename: `${newBook.id}.json`,
            contents: new TextEncoder().encode(JSON.stringify(newBook)),
          })
        } catch (error) {
          isLoading.value = false
          console.error('Error reading or saving the file:', error)
        }
      }
      reader.readAsArrayBuffer(file)
      isLoading.value = false
    }

    const deleteBook = async (id: number) => {
      try {
        await invoke('delete_book', { filename: `${id}.json` })
        await invoke('delete_book', { filename: `${id}.epub` })
        await invoke('webdav_delete', { filename: `${id}.json` })
        await invoke('webdav_delete', { filename: `${id}.epub` })
        books.value = books.value.filter((book) => book.id !== id)
      } catch (error) {
        console.error('Error deleting the book:', error)
      }
    }

    const openBook = (id: number) => {
      console.log('Opening book:', id)

      const webview = new WebviewWindow('reader', {
        url: 'reader.html',
        title: 'T-Reader',
        decorations: false,
        minHeight: 600,
        minWidth: 600,
      })

      webview.once('tauri://created', async function () {
        // 先移除相同的监听器
        unlistenReady.value?.()
        // 等待阅读器准备好接受书籍ID
        unlistenReady.value = await listen<string>(
          'ready-to-receive-book-id',
          async () => {
            console.log('Reader is ready to receive book ID')
            WebviewWindow.getCurrent().emitTo(
              'reader',
              'load-book-id',
              id.toString()
            )
          }
        )
      })

      webview.once('tauri://error', function () {
        // 阅读器已加载，此时只需要发送新的书籍ID
        WebviewWindow.getCurrent().emitTo(
          'reader',
          'load-book-id',
          id.toString()
        )
      })
    }

    // 右键菜单
    const onContextMenu = (e: MouseEvent, bookId: number) => {
      e.preventDefault()
      ContextMenu.showContextMenu({
        theme: 'default',
        x: e.x,
        y: e.y,
        items: [
          {
            label: '打开',
            svgIcon: '#icon-arrow-double-right',
            onClick: () => openBook(bookId),
          },
          {
            label: '删除',
            svgIcon: '#icon-ashbin',
            onClick: () => deleteBook(bookId),
          },
          {
            label: '信息',
            svgIcon: '#icon-prompt-filling',
            // 尚未完成，暂时只打印ID
            onClick: () => console.log('Info:', bookId),
          },
        ],
      })
    }

    onMounted(() => {
      loadBooks()
    })

    return {
      books,
      addBook,
      deleteBook,
      openBook,
      onContextMenu,
      syncFiles,
      isLoading,
    }
  },
}
</script>

<style scoped>
.main-content {
  flex: 1;
  padding: 20px;
  overflow: hidden;
  user-select: none;

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

    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-thumb {
      background-color: rgba(0, 0, 0, 0.2);
      border-radius: 6px;
    }
    &::-webkit-scrollbar-track {
      background-color: transparent;
    }

    .book-header,
    .book-item {
      display: grid;
      /* 1fr表示它将占据剩余的空间，而不是固定的大小。 */
      grid-template-columns: 50px 1fr 100px 50px 60px 100px 100px;
      gap: 10px;
      padding: 10px 0;

      span {
        display: flex;
        align-items: center;
        justify-content: flex-start;
      }
    }

    .book-item:hover {
      background: rgba(0, 0, 0, 0.15);
    }

    .book-header {
      font-weight: bold;
      border-bottom: 2px solid #ccc;
    }

    .book-item {
      border-bottom: 1px solid #eee;

      img {
        width: 50px;
        height: auto;
      }
    }
  }
}

.loading {
  backdrop-filter: blur(1px) brightness(0.6);
}
.loading-enter-active,
.loading-leave-active {
  transition: all 0.5s ease;
}
.loading-enter-from,
.loading-leave-to {
  opacity: 0;
  backdrop-filter: 0;
}
</style>
