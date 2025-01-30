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
    <!-- 书籍信息框 -->
    <BookInfoDialog v-model="bookInfoVisible" :bookId="bookInfoId" />
    <header class="header">
      <div class="header-menu">
        <div class="header-menu-item" @click="addBook">
          <span class="header-menu-icon">
            <img :src="addBookIcon" alt="添加书籍" />
          </span>
          <span class="header-menu-label">导入书籍</span>
        </div>
        <div class="header-menu-item" @click="syncFiles">
          <span class="header-menu-icon">
            <img :src="refreshIcon" alt="云同步" />
          </span>
          <span class="header-menu-label">云同步</span>
        </div>
        <div class="header-menu-item" @click="openSetting">
          <span class="header-menu-icon">
            <img :src="settingIcon" alt="设置" />
          </span>
          <span class="header-menu-label">设置中心</span>
        </div>
      </div>
      <SettingDialog
        v-model="settingVisible"
        @close-dialog="settingVisible = false"
      />
    </header>
    <div class="book-list">
      <el-divider border-style="dashed"/>
      <el-empty
        v-if="isBooksEmpty"
        :image="emptyStateImage"
        image-size="160px"
        description="点击添加书籍吧"
        style="flex: 1;"
        @click="addBook"
      />
      <div v-else class="bookcase">
        <el-skeleton :loading="booksLoading" animated :count="10">
          <template #template>
            <div class="book-item" style="background-color: white">
              <div class="book-cover">
                <el-skeleton-item style="width: 80px; height: 100px" />
              </div>
              <div class="book-desc">
                <div class="book-desc-header">
                  <div class="book-title">
                    <el-skeleton-item style="width: 200px; height: 30px" />
                  </div>
                  <div>
                    <el-skeleton-item style="width: 100px; height: 30px" />
                  </div>
                </div>
                <div class="book-desc-more">
                  <div class="book-desc-more-item" style="border: none;">
                    <el-skeleton-item style="width: 100px; height: 30px" />
                  </div>
                  <div class="book-desc-more-item" style="border: none;">
                    <el-skeleton-item style="width: 100px; height: 30px" />
                  </div>
                  <div class="book-desc-more-item" style="border: none;">
                    <el-skeleton-item style="width: 100px; height: 30px" />
                  </div>
                  <div class="book-desc-more-item" style="border: none;">
                    <el-skeleton-item style="width: 100px; height: 30px" />
                  </div>
                </div>
              </div>
            </div>
          </template>
          <template #default>
            <div
              class="book-item"
              v-for="book in books"
              :key="book.id"
              @click="openBook(book.id)"
              @contextmenu="onContextMenu($event, book.id)"
            >
              <div class="book-cover">
                <span>
                  <img :src="book.cover" alt="封面" />
                </span>
              </div>
              <div class="book-desc">
                <div class="book-desc-header">
                  <div class="book-title">
                    <span>{{ book.title }}</span>
                  </div>
                  <div class="book-author">
                    <span>{{ book.author }}</span>
                  </div>
                </div>
                <div class="book-desc-more">
                  <div class="book-desc-more-item">
                    <span>语言</span>
                    <span>{{ book.language }}</span>
                  </div>
                  <div class="book-desc-more-item">
                    <span>书籍大小</span>
                    <span>{{ book.size }}</span>
                  </div>
                  <div class="book-desc-more-item">
                    <span>上次阅读</span>
                    <span>{{ book.lastRead }}</span>
                  </div>
                  <div class="book-desc-more-item">
                    <span>添加时间</span>
                    <span>{{ book.added }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </el-skeleton>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { ref, onMounted } from 'vue'
import ePub from 'libs/epub.js'
import { invoke } from '@tauri-apps/api/core'
import { readFile, writeFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { open } from '@tauri-apps/plugin-dialog'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import loadingBlockade from './loadingBlockade.vue'
import ContextMenu from './ContextMenu/index.vue'
import { ContextMenuData, ContextMenuItem } from '../js/map'
import addBookIcon from '../assets/addBook.svg'
import refreshIcon from '../assets/refresh.svg'
import settingIcon from '../assets/setting.svg'
import emptyStateImage from '../assets/images/empty.png'
import SettingDialog from './SettingDialog/index.vue'
import BookInfoDialog from './BookInfoDialog/index.vue'
import '../js/iconfont.js'

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
    SettingDialog,
    BookInfoDialog,
  },
  setup() {
    const books = ref<Book[]>([])
    const isBooksEmpty = ref(false)
    const isLoading = ref(false) // 是否正在加载
    const booksLoading = ref(false) // 书籍是否加载完成
    const loadingText = ref(
      'Police line do not cross - Police line do not cross - Police line do not cross - Police line do not cross - Police line do not cross - Police line do not cross'
    ) // 加载时的提示文字
    const settingVisible = ref(false) // 设置中心
    const bookInfoVisible = ref(false) // 书籍信息框
    const bookInfoId = ref<String>('') // 书籍ID
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
        isBooksEmpty.value = books.value.length === 0
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
        minHeight: 660,
        minWidth: 880,
      })

      webview.once('tauri://created', async function () {
        // 先移除相同的监听器
        unlistenReady.value?.()
        // 等待阅读器准备好接受书籍ID
        unlistenReady.value = await listen<string>(
          'ready-to-receive-book-id',
          async () => {
            WebviewWindow.getCurrent().emitTo(
              'reader',
              'load-book-id',
              {
                id: id.toString(),
                cfi: '',
              }
            )
          }
        )
      })

      webview.once('tauri://error', function () {
        // 阅读器已加载，此时只需要发送新的书籍ID
        WebviewWindow.getCurrent().emitTo(
          'reader',
          'load-book-id',
          {
            id: id.toString(),
            cfi: '',
          }
        )
      })
    }

    const showBookInfo = (id: number) => {
      bookInfoId.value = id.toString()
      bookInfoVisible.value = true
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
          onClick: () => showBookInfo(bookId),
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
      addBookIcon,
      refreshIcon,
      settingIcon,
      openSetting,
      settingVisible,
      bookInfoVisible,
      bookInfoId,
      emptyStateImage,
      isBooksEmpty,
    }
  },
}
</script>

<style lang="scss" scoped>
.main-content {
  flex: 1;
  padding: 20px 0 20px 0;
  overflow: hidden;
  user-select: none;
  background: #f5f6fa;

  .header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 10px 0;

    .header-menu {
      padding: 0.5rem;
      background-color: #fff;
      position: relative;
      display: flex;
      justify-content: center;
      border-radius: 15px;
      box-shadow: var(--t-box-shadow-3d-inactive);

      &-item {
        display: inline-flex;
        justify-content: center;
        align-items: center;
        width: 56px;
        height: 40px;
        border-radius: 8px;
        position: relative;
        z-index: 1;
        overflow: hidden;
        transform-origin: center left;
        transition: width 0.2s ease-in;
        text-decoration: none;
        cursor: var(--t-mouse-cursor-link), pointer;

        &::before {
          position: absolute;
          z-index: -1;
          content: "";
          display: block;
          border-radius: 8px;
          width: 100%;
          height: 100%;
          top: 0;
          transform: translateX(100%);
          transition: transform 0.2s ease-in;
          transform-origin: center right;
          background-color: #eee;
        }

        &:hover {
          outline: 0;
          width: 130px;

          &::before,
          .header-menu-label {
            transform: translateX(0);
            opacity: 1;
          }
        }
      }
      &-icon {
        width: 24px;
        height: 24px;
        display: block;
        flex-shrink: 0;
        left: 17px;
        position: absolute;
        img {
          width: 100%;
          height: 100%;
        }
      }
      &-label {
        transform: translateX(100%);
        transition: transform 0.2s ease-in;
        transform-origin: center right;
        display: block;
        text-align: center;
        text-indent: 28px;
        width: 100%;
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

    :deep(.el-divider) {
      width: auto;
      margin: 12px 12px 6px 12px;
      border-top-width: 3px;
    }

    .book-item {
      display: flex;

      .book-cover {
        width: 80px;

        span {
          width: 100%;
          display: flex;

          img {
            width: 100%;
            border-radius: 10px;
          }
        }
      }
      .book-desc {
        display: flex;
        flex: 1;
        flex-direction: column;
        margin-left: 10px;

        &-header {
          display: inline-flex;
          gap: 8px;

          .book-title {
            font-size: 20px;
            font-weight: bold;
            border-radius: 6px;
            transition: all 0.2s ease-in;

            span {
              position: relative;
              padding: 0 4px;
            }

            span::after {
              content: "";
              position: absolute;
              left: 0;
              bottom: 0;
              width: 0;
              height: 2px;
              background: var(--t-color-light-yellow);
              transition: width 0.2s ease-in
            }
          }
          .book-author {
            background: var(--t-color-light-blue);
            color: #ffffff;
            padding: 0 5px;
            border-radius: 6px;
            text-align: center;
            align-content: center;
          }
        }
        &-more {
          display: inline-flex;
          flex: 1;
          align-items: center;

          &-item:last-child {
            border-right: none;
          }

          &-item {
            display: inline-flex;
            flex-direction: column;
            width: 120px;
            height: 44px;
            padding: 0 10px;
            justify-content: center;
            align-items: center;
            border-right: 2px dashed var(--t-color-cyan-blue);

            span {
              line-height: 22px;
            }

            span:first-child{
              color: var(--t-color-dark-grey);
              font-weight: 900;
            }
          }
        }
      }
      
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
        padding: 8px;
        margin: 6px 4px 10px 10px;
        background: #ffffff;
        border-radius: 10px;
        cursor: var(--t-mouse-cursor-link), pointer;
        border: 1.5px solid #f2f3f5;
        transition: ease 0.2s;
        box-shadow: var(--t-box-shadow-3d-inactive);

        &:hover {
          translate: 0 0.225em;
          background: transparent;
          border: var(--t-border-thin-yellow);
          box-shadow: var(--t-box-shadow-3d-active);

          .book-title {
            span::after {
              width: 100%;
            }
          }
        }

        .book-title:hover {
          color: #ffffff;
          background: var(--t-color-light-yellow);

          span::after {
            opacity: 0;
          }
        }

        .book-desc-more-item:hover {
          span {
            color: var(--t-color-light-yellow);
          }
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
