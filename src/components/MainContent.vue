<template>
  <div class="main-content">
    <!-- 加载条动画 -->
    <Transition name="loading">
      <loadingBlockade
        v-if="isLoading"
        class="loading"
        :warn-text="loadingText"
      />
    </Transition>
    <!-- 自定义右键菜单 -->
    <ContextMenu v-model:show="showMenu" :menu-data="menuOptions" />
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
      <button class="button" @click="openSetting">
        <div class="icon">
          <img :src="settingIcon" alt="设置" />
        </div>
      </button>
      <SettingDialog v-model="settingVisible" @close-dialog="settingVisible = false"/>
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
      <div class="bookcase">
        <el-skeleton :loading="booksLoading" animated :count="10">
          <template #template>
            <div class="book-item" style="background-color: white">
              <span
                ><el-skeleton-item
                  variant="image"
                  style="width: 50px; height: 75px"
              /></span>
              <span
                ><el-skeleton-item
                  variant="text"
                  style="width: 100px; height: 40px"
              /></span>
              <span
                ><el-skeleton-item
                  variant="text"
                  style="width: 80px; height: 22px"
              /></span>
              <span
                ><el-skeleton-item
                  variant="text"
                  style="width: 50px; height: 18px"
              /></span>
              <span
                ><el-skeleton-item
                  variant="text"
                  style="width: 60px; height: 18px"
              /></span>
              <span
                ><el-skeleton-item
                  variant="text"
                  style="width: 100px; height: 18px"
              /></span>
              <span
                ><el-skeleton-item
                  variant="text"
                  style="width: 100px; height: 18px"
              /></span>
            </div>
          </template>
          <template #default>
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
          </template>
        </el-skeleton>
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
import loadingBlockade from './loadingBlockade.vue'
import ContextMenu from './ContextMenu/index.vue'
import { ContextMenuData, ContextMenuItem } from '../js/map'
import settingIcon from '../assets/setting.svg'
import SettingDialog from './SettingDialog/index.vue'

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
    ContextMenu,
    SettingDialog
  },
  setup() {
    const books = ref<Book[]>([])
    const isLoading = ref(false) // 是否正在加载
    const booksLoading = ref(false) // 书籍是否加载完成
    const loadingText = ref(
      'Police line do not cross - Police line do not cross - Police line do not cross - Police line do not cross - Police line do not cross - Police line do not cross'
    ) // 加载时的提示文字
    const settingVisible = ref(false) // 设置中心
    const defaultCover = './src/assets/default-cover.png'
    let unlistenReady = ref<UnlistenFn | null>(null)
    const showMenu = ref(false)
    const menuOptions = ref({} as ContextMenuData)

    const loadBooks = async () => {
      try {
        booksLoading.value = true
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
            book.cover = cover ?? defaultCover
            // 正常添加该书籍
            books.value.push(book)
          } catch (error) {
            console.error('Error loading cover for book:', book.title, error)
          }
        }
        booksLoading.value = false
      } catch (error) {
        console.error('Error loading books:', error)
      }
    }

    const syncFiles = async () => {
      loadingText.value =
        'Downloading files from server - Downloading files from server - Downloading files from server - Downloading files from server - Downloading files from server - Downloading files from server'
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
      loadingText.value =
        'Parsing ePub file - Parsing ePub file - Parsing ePub file - Parsing ePub file - Parsing ePub file - Parsing ePub file'
      isLoading.value = true
      const u8File: Uint8Array = await invoke('read_file_by_path', {
        filepath: selectedFilePath,
      })
      const bufferFile = new Uint8Array(u8File).buffer
      const file = new Blob([bufferFile], { type: 'application/epub+zip' })

      const newBookId = Date.now()
      const newBookPath = `T-Reader/${newBookId}.epub`
      const contents = new Uint8Array(bufferFile)

      loadingText.value =
        'Uploading book to server - Uploading book to server - Uploading book to server - Uploading book to server - Uploading book to server - Uploading book to server'

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
            cover: cover ?? defaultCover,
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
      //e.preventDefault()
      let menuX = e.x
      let menuY = e.y
      // 菜单选项
      const menuItems: ContextMenuItem[] = [
        {
          label: '打开 | 开始阅读',
          type: 'bookOpen',
          onClick: () => openBook(bookId),
        },
        {
          label: '信息 | 详细信息',
          type: 'info',
          onClick: () => console.log('Info:', bookId),
        },
        {
          label: '删除 | 更新云同步',
          type: 'delete',
          onClick: () => deleteBook(bookId),
        },
      ]
      const menuWidth = 200 // 菜单宽度
      const menuHeight = 35 * menuItems.length // 菜单预估高度
      const pageWidth = document.documentElement.clientWidth // 页面宽度
      const pageHeight = document.documentElement.clientHeight // 页面高度
      const precision = 20 // 菜单距离页面边缘的最小距离
      // 如果菜单最右边超过页面宽度，则调整位置
      if (menuX + menuWidth > pageWidth) {
        menuX -= menuWidth
      }
      menuX = Math.max(precision, menuX)
      menuX = Math.min(pageWidth - precision - menuWidth, menuX)
      // 如果菜单最下边超过页面高度，则调整位置
      if (menuY + menuHeight > pageHeight) {
        menuY -= menuHeight
      }
      menuY = Math.max(precision, menuY)
      menuY = Math.min(pageHeight - precision - menuHeight, menuY)
      // 赋值
      menuOptions.value = {
        x: menuX,
        y: menuY,
        width: menuWidth,
        items: menuItems,
        theme: 'dark',
      }
      // 显示菜单
      showMenu.value = true
    }

    // 打开设置
    const openSetting = () => {
      settingVisible.value = true
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
      loadingText,
      showMenu,
      menuOptions,
      booksLoading,
      settingIcon,
      openSetting,
      settingVisible,
    }
  },
}
</script>

<style scoped>
.main-content {
  flex: 1;
  padding: 20px 0 20px 0;
  overflow: hidden;
  user-select: none;

  .header {
    display: flex;
    align-items: center;
    margin: 10px 0 10px 20px;
    gap: 10px;
    
    .button {
      .icon {
        img {
          width: 25px;
          height: 25px;
        }
      }
    }

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
      grid-template-columns: 50px 1fr 100px 40px 60px 100px 100px;
      gap: 10px;

      span {
        display: flex;
        align-items: center;
        justify-content: flex-start;
      }
    }

    .book-header {
      font-weight: bold;
      border-bottom: 2px solid #ccc;
      padding: 10px 0;
      margin: 0 20px;
    }

    .bookcase {
      min-height: 0;
      overflow: auto;

      &:hover {
        &::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.2);
        }
      }

      &::-webkit-scrollbar {
        width: 6px;
      }
      &::-webkit-scrollbar-thumb {
        background-color: transparent;
        border-radius: 6px;
      }
      &::-webkit-scrollbar-track {
        background-color: transparent;
      }

      .book-item {
        border-bottom: 1px solid #eee;
        padding: 10px;
        margin: 5px 4px 0 10px;
        background: #f2f3f7;
        border-radius: 10px;
        cursor: pointer;
        border: 1.5px solid #f2f3f7;
        transition: ease 0.2s;

        &:hover {
          background-color: #d3ddf1;
          border: 1.5px solid #1677ff;
        }

        img {
          width: 50px;
          height: auto;
        }
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
