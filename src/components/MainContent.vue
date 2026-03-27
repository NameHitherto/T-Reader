<template>
  <div class="main-content">
    <!-- 加载遮罩 -->
    <Transition name="loading">
      <loadingBlockade
        v-if="isLoading"
        class="loading"
        :warn-text="loadingText"
      />
    </Transition>
    <!-- 自定义右键菜单 -->
    <ContextMenu v-model:show="showMenu" :menu-data="menuOptions" />
    <!-- 书籍信息弹窗 -->
    <BookInfoDialog v-model="bookInfoVisible" :bookKey="bookInfoKey" />
    <header class="header">
      <div class="header-menu">
        <div class="header-menu-item" @click="addBook">
          <span class="header-menu-icon">
            <AppIcon name="addBook" aria-label="添加书籍" />
          </span>
          <span class="header-menu-label">导入书籍</span>
        </div>
        <div class="header-menu-item" @click="syncFiles">
          <span class="header-menu-icon">
            <AppIcon name="refresh" aria-label="云同步" />
          </span>
          <span class="header-menu-label">云同步</span>
        </div>
        <div class="header-menu-item" @click="openSetting">
          <span class="header-menu-icon">
            <AppIcon name="setting" aria-label="设置" />
          </span>
          <span class="header-menu-label">设置中心</span>
        </div>
        <div class="header-menu-item" @click="toggleShelfViewMode">
          <span class="header-menu-icon">
            <AppIcon
              :name="shelfViewMode === 'list' ? 'listView' : 'gridView'"
              :aria-label="shelfViewMode === 'list' ? '列表模式' : '网格模式'"
            />
          </span>
          <span class="header-menu-label">
            {{ shelfViewMode === 'list' ? '切换网格' : '切换列表' }}
          </span>
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
        v-if="!booksLoading && isBooksEmpty"
        :image="emptyStateImage"
        image-size="160px"
        description="点击添加书籍吧"
        style="flex: 1;"
        @click="addBook"
      />
      <div v-else class="bookcase">
        <div v-if="booksLoading" class="bookcase-placeholder">
          正在加载书架数据...
        </div>
        <div
          v-else
          class="bookcase-body"
          :class="
            shelfViewMode === 'list'
              ? 'bookcase-body--list'
              : 'bookcase-body--grid'
          "
        >
          <div
            v-for="book in books"
            :key="book.bookKey"
            class="shelf-item"
            :class="
              shelfViewMode === 'list' ? 'shelf-list-card' : 'shelf-grid-card'
            "
            @click="openBook(book.bookKey)"
            @contextmenu="onContextMenu($event, book.bookKey)"
          >
            <div
              v-if="shelfViewMode === 'list'"
              class="shelf-list-cover"
            >
              <img :src="getBookCover(book.cover)" alt="封面" />
              <span class="book-format-badge">
                {{ getBookFormatBadge(book) }}
              </span>
            </div>
            <div
              v-if="shelfViewMode === 'list'"
              class="shelf-list-content"
            >
              <div
                v-if="book.author"
                class="shelf-list-author"
                :title="book.author"
              >
                {{ book.author }}
              </div>
              <div class="shelf-list-title" :title="book.displayTitle">
                <span>{{ book.displayTitle }}</span>
              </div>
              <div class="shelf-list-subtitle" :title="getListSubtitle(book)">
                {{ getListSubtitle(book) }}
              </div>
              <div class="shelf-list-meta" :title="getListMeta(book)">
                {{ getListMeta(book) }}
              </div>
              <div class="shelf-list-progress">
                <div class="shelf-progress-label">
                  {{ getProgressPercent(book) }}
                </div>
                <div class="shelf-progress-track">
                  <div
                    class="shelf-progress-value"
                    :style="{ width: `${getProgressValue(book)}%` }"
                  />
                </div>
              </div>
            </div>

            <template v-else>
              <div class="shelf-grid-cover">
                <img :src="getBookCover(book.cover)" alt="封面" />
                <span class="book-format-badge">
                  {{ getBookFormatBadge(book) }}
                </span>
                <div class="shelf-grid-progress-overlay">
                  {{ getGridProgressText(book) }}
                </div>
              </div>
              <div class="shelf-grid-title" :title="book.displayTitle">
                {{ book.displayTitle }}
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import loadingBlockade from '@/components/common/LoadingBlockade/index.vue'
import ContextMenu from './ContextMenu/index.vue'
import AppIcon from '@/components/common/AppIcon/index.vue'
import { BookConfig, ContextMenuData, ContextMenuItem } from '../js/map'
import emptyStateImage from '../assets/images/empty.png'
import SettingDialog from './SettingDialog/index.vue'
import BookInfoDialog from './BookInfoDialog/index.vue'
import '../js/iconfont.js'
import defaultCover from '@/assets/default-cover.png'
import {
  BookFormat,
  detectBookFormatFromPath,
  getFileNameFromPath,
} from '@/js/bookFormat'
import { WINDOW_EVENTS } from '@/constants/events'
import { buildBookConfigFromImport } from '@/services/book/bookImportService'
import { getLocalDirNames } from '@/services/fileSystem/dirService'
import type { LocalDirNames } from '@/services/fileSystem/dirService'
import {
  getBookCacheFilename,
  primeBookCacheAfterImport,
} from '@/services/book/bookCacheService'
import {
  buildLastReadLabel,
  deriveShelfProgress,
} from '@/services/book/bookPresentationService'
import {
  ensureBookCache,
  getImportedBookName,
  hasOriginalFilenameConflict,
  invalidateBookFileIndex,
  loadBookBinary,
  loadBookConfigs,
  resolveBookFile,
  resolveBookFormat,
  StoredBookConfig,
} from '@/services/book/bookRepository'
import { removeBookMarksByBookKey } from '@/services/book/bookMarksRepository'
import { toBookConfigFilename } from '@/services/book/bookIdentity'
import {
  createMainTaskBatchNotifier,
  showMainTaskMessage,
} from '@/services/notification/mainTaskMessageService'
import {
  createDurationLogger,
  logError,
  logInfo,
  logWarn,
} from '@/utils/logger'
import { stringifyJson } from '@/utils/json'

export default {
  name: 'MainContent',
  components: {
    loadingBlockade,
    ContextMenu,
    AppIcon,
    SettingDialog,
    BookInfoDialog,
  },
  setup() {
    type ShelfViewMode = 'list' | 'grid'
    type ShelfBook = BookConfig & {
      bookKey: string
      displayTitle: string
      cover?: string
      format: BookFormat
      progressValue: number
      lastReadLabel: string
    }

    interface BatchImportContext {
      batchNotifier: ReturnType<typeof createMainTaskBatchNotifier>
      dirs: LocalDirNames
      reservedBookKeys: Set<string>
      reservedOriginalFileNames: Set<string>
    }

    const MAX_PARALLEL_IMPORTS = 3
    const IMPORT_LOADING_TEXT = {
      parsing:
        'Parsing book files - Parsing book files - Parsing book files - Parsing book files - Parsing book files - Parsing book files',
      saving:
        'Saving book files - Saving book files - Saving book files - Saving book files - Saving book files - Saving book files',
      uploading:
        'Uploading books to server - Uploading books to server - Uploading books to server - Uploading books to server - Uploading books to server - Uploading books to server',
      syncing:
        'Downloading files from server - Downloading files from server - Downloading files from server - Downloading files from server - Downloading files from server - Downloading files from server',
    } as const

    const books = ref<ShelfBook[]>([])
    const isLoading = ref(false)
    const booksLoading = ref(true)
    const loadingText = ref(
      'Police line do not cross - Police line do not cross - Police line do not cross - Police line do not cross - Police line do not cross - Police line do not cross'
    )
    const activeLoadingTasks = ref(0)
    const settingVisible = ref(false)
    const bookInfoVisible = ref(false)
    const bookInfoKey = ref<String>('')
    const unlistenReady = ref<UnlistenFn | null>(null)
    const showMenu = ref(false)
    const menuOptions = ref({} as ContextMenuData)
    const isBooksEmpty = computed(() => books.value.length === 0)
    const shelfViewMode = ref<ShelfViewMode>(
      localStorage.getItem('shelfViewMode') === 'grid' ? 'grid' : 'list'
    )

    const toggleShelfViewMode = () => {
      shelfViewMode.value = shelfViewMode.value === 'list' ? 'grid' : 'list'
      localStorage.setItem('shelfViewMode', shelfViewMode.value)
    }

    const toTaskErrorMessage = (error: unknown): string => {
      if (error instanceof Error) {
        return error.message
      }

      if (typeof error === 'string') {
        return error
      }

      return '发生未知异常'
    }

    const beginLoading = (text: string) => {
      activeLoadingTasks.value += 1
      loadingText.value = text
      isLoading.value = true
    }

    const updateLoadingText = (text: string) => {
      if (activeLoadingTasks.value > 0) {
        loadingText.value = text
      }
    }

    const endLoading = () => {
      activeLoadingTasks.value = Math.max(0, activeLoadingTasks.value - 1)
      isLoading.value = activeLoadingTasks.value > 0
    }

    const normalizeOriginalFileName = (fileName: string) => fileName.toLowerCase()

    const runWithConcurrencyLimit = async <T>(
      items: readonly T[],
      limit: number,
      worker: (item: T, index: number) => Promise<void>
    ) => {
      let nextIndex = 0
      const workerCount = Math.min(limit, items.length)

      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (true) {
            const currentIndex = nextIndex
            nextIndex += 1

            if (currentIndex >= items.length) {
              return
            }

            await worker(items[currentIndex], currentIndex)
          }
        })
      )
    }

    const buildShelfBook = async (storedBook: StoredBookConfig): Promise<ShelfBook> => {
      const { bookKey, config: book } = storedBook
      const finishLog = createDurationLogger('bookshelf', 'build-shelf-book', {
        bookKey,
      })
      const format = await resolveBookFormat(bookKey)
      const cache = await ensureBookCache(bookKey)
      const hasEpubProgress =
        typeof book.durChapterIndex === 'number' &&
        (book.durChapterIndex !== 0 ||
          (book.durChapterPos || 0) > 0 ||
          Boolean(book.durChapterTitle))
      const bookData =
        format === 'epub' && hasEpubProgress
          ? (await loadBookBinary(bookKey)).bookData
          : undefined
      const progressValue = await deriveShelfProgress(book, format, cache, bookData)

      const shelfBook = {
        ...book,
        bookKey,
        displayTitle: cache.title || book.name,
        cover: cache.cover,
        format,
        progressValue,
        lastReadLabel: buildLastReadLabel(book, progressValue),
      }

      finishLog({
        bookKey,
        format,
        progressValue,
      })
      return shelfBook
    }

    const loadBooks = async () => {
      const finishLog = createDurationLogger('bookshelf', 'load-books')
      try {
        booksLoading.value = true
        const loadedBooks = await loadBookConfigs()
        books.value = await Promise.all(loadedBooks.map((book) => buildShelfBook(book)))
        finishLog({
          total: books.value.length,
        })
      } catch (error) {
        logError('bookshelf', 'load-books failed', error)
      } finally {
        booksLoading.value = false
      }
    }

    const syncFiles = async () => {
      const finishLog = createDurationLogger('bookshelf', 'sync-files')
      beginLoading(IMPORT_LOADING_TEXT.syncing)
      try {
        await invoke('webdav_sync_files')
        invalidateBookFileIndex()
        await loadBooks()
        showMainTaskMessage({
          type: 'success',
          title: '云同步完成',
          message: '书架数据已完成同步并刷新。',
          taskKey: 'bookshelf-sync',
        })
        finishLog({
          total: books.value.length,
        })
      } catch (error) {
        logError('bookshelf', 'sync-files failed', error)
        showMainTaskMessage({
          type: 'error',
          title: '云同步失败',
          message: toTaskErrorMessage(error),
          taskKey: 'bookshelf-sync',
        })
      } finally {
        endLoading()
      }
    }

    const addBook = async () => {
      const selectedFilePath = await open({
        multiple: true,
        directory: false,
        filters: [
          {
            name: 'Book files',
            extensions: ['epub', 'txt'],
          },
        ],
      })

      if (selectedFilePath === null) {
        return
      }

      const selectedPaths = Array.isArray(selectedFilePath) ? selectedFilePath : [selectedFilePath]
      const parallelImports = Math.min(MAX_PARALLEL_IMPORTS, selectedPaths.length)

      logInfo('bookshelf', 'select-book-files', {
        count: selectedPaths.length,
        parallelImports,
      })

      const batchNotifier = createMainTaskBatchNotifier({
        taskKey: 'bookshelf-import-cloud-sync',
        successTitle: '云端同步完成',
        partialFailureTitle: '云端同步部分完成',
        errorTitle: '云端同步失败',
        actionLabel: '云端同步',
      })

      const dirs = await getLocalDirNames()
      const batchContext: BatchImportContext = {
        batchNotifier,
        dirs,
        reservedBookKeys: new Set<string>(),
        reservedOriginalFileNames: new Set<string>(),
      }

      try {
        await runWithConcurrencyLimit(selectedPaths, parallelImports, (path) =>
          addBookByPath(path, batchContext)
        )
      } finally {
        batchNotifier.flushWhenComplete()
      }
    }

    const addBookByPath = async (path: string, batchContext: BatchImportContext) => {
      const originalFileName = getFileNameFromPath(path)
      const normalizedOriginalFileName = normalizeOriginalFileName(originalFileName)
      const format = detectBookFormatFromPath(path)
      if (!format) {
        logWarn('bookshelf', 'unsupported-book-format', {
          path,
        })
        return
      }

      if (batchContext.reservedOriginalFileNames.has(normalizedOriginalFileName)) {
        logWarn('bookshelf', 'duplicate-batch-file-name-detected', {
          fileName: originalFileName,
          path,
        })
        return
      }

      const finishLog = createDurationLogger('bookshelf', 'import-book', {
        fileName: originalFileName,
        format,
      })
      batchContext.reservedOriginalFileNames.add(normalizedOriginalFileName)
      let reservedBookKey: string | null = null
      beginLoading(IMPORT_LOADING_TEXT.parsing)

      try {
        if (await hasOriginalFilenameConflict(originalFileName)) {
          logWarn('bookshelf', 'duplicate-file-name-detected', {
            fileName: originalFileName,
          })
          return
        }

        const u8File: Uint8Array = await invoke('read_file_by_path', {
          filepath: path,
        })
        const fileBytes = u8File instanceof Uint8Array ? u8File : new Uint8Array(u8File)
        const bufferFile = fileBytes.buffer.slice(
          fileBytes.byteOffset,
          fileBytes.byteOffset + fileBytes.byteLength
        ) as ArrayBuffer
        const importedBook = await getImportedBookName(originalFileName, bufferFile)

        if (
          batchContext.reservedBookKeys.has(importedBook.bookKey) ||
          books.value.find((book) => book.bookKey === importedBook.bookKey)
        ) {
          logWarn('bookshelf', 'duplicate-book-detected', {
            bookKey: importedBook.bookKey,
            fileName: originalFileName,
          })
          return
        }
        batchContext.reservedBookKeys.add(importedBook.bookKey)
        reservedBookKey = importedBook.bookKey
        const newBook = await buildBookConfigFromImport({
          sourcePath: path,
          originalFileName,
          format,
          fileBuffer: bufferFile,
        })
        const bookConfigJson = stringifyJson(newBook)
        const encodedBookConfig = new TextEncoder().encode(bookConfigJson)

        updateLoadingText(IMPORT_LOADING_TEXT.saving)

        await invoke('write_file', {
          subdir: batchContext.dirs.books,
          filename: originalFileName,
          contents: Array.from(fileBytes),
        })

        await invoke('save_file', {
          subdir: batchContext.dirs.progress,
          filename: toBookConfigFilename(importedBook.bookKey),
          contents: bookConfigJson,
        })

        invalidateBookFileIndex()
        const cachedPayload = await primeBookCacheAfterImport(
          importedBook.bookKey,
          bufferFile,
          format,
          originalFileName
        )

        books.value.push({
          ...newBook,
          bookKey: importedBook.bookKey,
          displayTitle: cachedPayload.title || newBook.name,
          cover: cachedPayload.cover,
          format,
          progressValue: 0,
          lastReadLabel: '未读',
        })

        updateLoadingText(IMPORT_LOADING_TEXT.uploading)

        const bookLabel = cachedPayload.title || newBook.name || importedBook.name
        batchContext.batchNotifier.registerTask(bookLabel)
        queueMicrotask(() => {
          void Promise.allSettled([
            invoke('webdav_upload', {
              subdir: batchContext.dirs.books,
              filename: originalFileName,
              contents: Array.from(fileBytes),
            }),
            invoke('webdav_upload', {
              subdir: batchContext.dirs.progress,
              filename: toBookConfigFilename(importedBook.bookKey),
              contents: Array.from(encodedBookConfig),
            }),
          ])
            .then((results) => {
              const rejected = results.find((result) => result.status === 'rejected')
              if (rejected) {
                const reason = toTaskErrorMessage(rejected.reason)
                logWarn('bookshelf', 'import-book remote-sync-failed', {
                  bookKey: importedBook.bookKey,
                  fileName: originalFileName,
                  reason,
                })
                batchContext.batchNotifier.recordFailure(bookLabel, reason)
                return
              }

              batchContext.batchNotifier.recordSuccess(bookLabel)
            })
        })
        finishLog({
          bookKey: importedBook.bookKey,
          total: books.value.length,
        })
      } catch (error) {
        logError('bookshelf', 'import-book failed', error, {
          fileName: originalFileName,
        })
      } finally {
        batchContext.reservedOriginalFileNames.delete(normalizedOriginalFileName)
        if (reservedBookKey) {
          batchContext.reservedBookKeys.delete(reservedBookKey)
        }
        endLoading()
      }
    }

    const deleteBook = async (bookKey: string) => {
      const finishLog = createDurationLogger('bookshelf', 'delete-book', {
        bookKey,
      })
      try {
        const dirs = await getLocalDirNames()
        const targetBook = books.value.find((book) => book.bookKey === bookKey)
        const resolvedBookFile = targetBook ? await resolveBookFile(bookKey) : null

        await invoke('delete_book', {
          subdir: dirs.progress,
          filename: toBookConfigFilename(bookKey),
        })

        if (resolvedBookFile) {
          await invoke('delete_book', {
            subdir: dirs.books,
            filename: resolvedBookFile.fileName,
          })
        }

        if (targetBook) {
          await invoke('delete_book', {
            subdir: dirs.cached,
            filename: getBookCacheFilename(targetBook.bookKey),
          })
        }

        await removeBookMarksByBookKey(bookKey)

        invalidateBookFileIndex()
        books.value = books.value.filter((book) => book.bookKey !== bookKey)
        showMenu.value = false

        queueMicrotask(() => {
          void Promise.allSettled([
            invoke('webdav_delete', {
              subdir: dirs.progress,
              filename: toBookConfigFilename(bookKey),
            }),
            ...(resolvedBookFile
              ? [
                  invoke('webdav_delete', {
                    subdir: dirs.books,
                    filename: resolvedBookFile.fileName,
                  }),
                ]
              : []),
          ]).then((results) => {
            const rejected = results.find((result) => result.status === 'rejected')
            if (rejected) {
              logWarn('bookshelf', 'delete-book remote-cleanup-failed', {
                bookKey,
              })
              showMainTaskMessage({
                type: 'warning',
                title: '云端清理失败',
                message: `本地已删除书籍，但云端清理失败：${toTaskErrorMessage(rejected.reason)}`,
                taskKey: `bookshelf-delete:${bookKey}`,
              })
              return
            }

            showMainTaskMessage({
              type: 'success',
              title: '删除完成',
              message: '书籍已从本地与云端同步清理。',
              taskKey: `bookshelf-delete:${bookKey}`,
            })
          })
        })

        finishLog({
          total: books.value.length,
        })
      } catch (error) {
        logError('bookshelf', 'delete-book failed', error, {
          bookKey,
        })
        showMainTaskMessage({
          type: 'error',
          title: '删除失败',
          message: toTaskErrorMessage(error),
          taskKey: `bookshelf-delete:${bookKey}`,
        })
      }
    }

    const openBook = (bookKey: string) => {
      const webview = new WebviewWindow('reader', {
        url: 'reader.html',
        title: '阅读',
        decorations: false,
        minHeight: 660,
        minWidth: 880,
      })

      webview.once('tauri://created', async function () {
        unlistenReady.value?.()
        unlistenReady.value = await listen<string>(
          WINDOW_EVENTS.READY_TO_RECEIVE_BOOK_KEY,
          async () => {
            WebviewWindow.getCurrent().emitTo('reader', WINDOW_EVENTS.LOAD_BOOK_KEY, {
              bookKey: bookKey.toString(),
              cfi: '',
            })
          }
        )
      })

      webview.once('tauri://error', function () {
        WebviewWindow.getCurrent().emitTo('reader', WINDOW_EVENTS.LOAD_BOOK_KEY, {
          bookKey: bookKey.toString(),
          cfi: '',
        })
      })
    }

    const showBookInfo = (bookKey: string) => {
      bookInfoKey.value = bookKey.toString()
      bookInfoVisible.value = true
    }

    const onContextMenu = (e: MouseEvent, bookKey: string) => {
      let menuX = e.x
      let menuY = e.y
      const menuItems: ContextMenuItem[] = [
        {
          label: '打开 | 开始阅读',
          type: 'bookOpen',
          onClick: () => openBook(bookKey),
        },
        {
          label: '信息 | 详细信息',
          type: 'info',
          onClick: () => showBookInfo(bookKey),
        },
        {
          label: '删除 | 更新云同步',
          type: 'delete',
          onClick: () => deleteBook(bookKey),
        },
      ]
      const menuWidth = 200
      const menuHeight = 35 * menuItems.length
      const pageWidth = document.documentElement.clientWidth
      const pageHeight = document.documentElement.clientHeight
      const precision = 20

      if (menuX + menuWidth > pageWidth) {
        menuX -= menuWidth
      }
      menuX = Math.max(precision, menuX)
      menuX = Math.min(pageWidth - precision - menuWidth, menuX)

      if (menuY + menuHeight > pageHeight) {
        menuY -= menuHeight
      }
      menuY = Math.max(precision, menuY)
      menuY = Math.min(pageHeight - precision - menuHeight, menuY)

      menuOptions.value = {
        x: menuX,
        y: menuY,
        width: menuWidth,
        items: menuItems,
        theme: 'dark',
      }
      showMenu.value = true
    }

    const openSetting = () => {
      settingVisible.value = true
    }

    const getBookCover = (cover?: string) => {
      if (cover && cover.startsWith('data:image')) return cover
      return defaultCover
    }

    const getBookFormatBadge = (book: ShelfBook): string => {
      return book.format === 'txt' ? 'TXT' : 'EPUB'
    }

    const getProgressValue = (book: ShelfBook): number => {
      const value = Number(book.progressValue ?? 0)
      if (Number.isNaN(value)) {
        return 0
      }
      return Math.min(100, Math.max(0, value))
    }

    const getProgressPercent = (book: ShelfBook): string => {
      return `${getProgressValue(book).toFixed(1)}%`
    }

    const getGridProgressText = (book: ShelfBook): string => {
      const progress = getProgressValue(book)
      return progress > 0 ? `阅读进度：${progress.toFixed(1)}%` : '未读'
    }

    const getListSubtitle = (book: ShelfBook): string => {
      return book.author ? `作者：${book.author}` : '作者：未知'
    }

    const getListMeta = (book: ShelfBook): string => {
      return `最近阅读：${book.lastReadLabel}`
    }

    onMounted(() => {
      loadBooks()
    })

    onUnmounted(() => {
      unlistenReady.value?.()
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
      openSetting,
      settingVisible,
      bookInfoVisible,
      bookInfoKey,
      emptyStateImage,
      isBooksEmpty,
      getBookCover,
      shelfViewMode,
      toggleShelfViewMode,
      getBookFormatBadge,
      getProgressValue,
      getProgressPercent,
      getGridProgressText,
      getListSubtitle,
      getListMeta,
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
        transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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

        :deep(.app-icon) {
          width: 100%;
          height: 100%;
          color: #3f3f46;
        }
      }
      &-label {
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        transform-origin: center right;
        display: block;
        text-align: center;
        text-indent: 28px;
        width: 100%;
        opacity: 0;
      }
    }
  }

  .book-list {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
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
        min-height: 120px;
        display: inline-flex;

        span {
          width: 100%;
          align-self: center;
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

      .bookcase-body {
        padding: 10px 12px 14px;
      }

      .bookcase-body--list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .bookcase-body--grid {
        --shelf-grid-gap: 20px;
        --shelf-grid-item-width: 148px;
        display: grid;
        gap: var(--shelf-grid-gap);
        justify-content: start;
        /* 固定列宽自动填充：书架变宽时优先加列，卡片宽度保持稳定 */
        grid-template-columns: repeat(
          auto-fill,
          minmax(var(--shelf-grid-item-width), var(--shelf-grid-item-width))
        );
        transition: gap 0.28s ease;
      }

      .shelf-item {
        cursor: var(--t-mouse-cursor-link), pointer;
      }

      .bookcase-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 240px;
        color: #6b7280;
        font-size: 14px;
      }

      .shelf-list-card {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 16px;
        position: relative;
        background: #ffffff;
        border-radius: 12px;
        padding: 16px;
        border: 1px solid #edf0f4;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease,
          padding 0.28s ease,
          border-radius 0.28s ease;

        &:hover {
          transform: translateY(2px);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
        }
      }

      .shelf-list-cover {
        position: relative;
        flex: 0 0 auto;
        width: 72px;
        height: 96px;
        border-radius: 10px;
        overflow: hidden;
        transition: width 0.28s ease, height 0.28s ease, border-radius 0.28s ease;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
      }

      .book-format-badge {
        position: absolute;
        top: 0;
        right: 0;
        color: #fff;
        background: rgba(17, 24, 39, 0.55);
        font-size: 10px;
        line-height: 1;
        padding: 4px 6px;
      }

      .shelf-list-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding-right: 72px;
        transition: padding-right 0.28s ease, gap 0.28s ease;
      }

      .shelf-list-author {
        position: absolute;
        top: 12px;
        right: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        max-width: 64px;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--t-color-light-blue);
        color: #ffffff;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition:
          transform 0.2s ease,
          background-color 0.2s ease,
          top 0.28s ease,
          right 0.28s ease,
          max-width 0.28s ease,
          padding 0.28s ease,
          font-size 0.28s ease;
      }

      .shelf-list-author:hover {
        transform: translateY(-1px);
        background: #1668c5;
      }

      .shelf-list-title {
        width: fit-content;
        font-size: 16px;
        line-height: 1.35;
        font-weight: 700;
        color: #1f2937;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: font-size 0.28s ease;

        span {
          position: relative;
          padding: 0 4px;
          border-radius: 6px;
          transition: all 0.2s ease-in;
        }

        span::after {
          content: "";
          position: absolute;
          left: 0;
          bottom: 0;
          width: 0;
          height: 2px;
          background: var(--t-color-light-yellow);
          transition: width 0.2s ease-in;
        }
      }

      .shelf-list-card:hover {
        .shelf-list-title {
          span::after {
            width: 100%;
          }
        }
      }

      .shelf-list-title:hover {
        span {
          background: var(--t-color-light-yellow);
          color: #ffffff;
        }

        span::after {
          opacity: 0;
        }
      }

      .shelf-list-subtitle,
      .shelf-list-meta {
        font-size: 12px;
        color: #6b7280;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: font-size 0.28s ease;
      }

      .shelf-list-progress {
        margin-top: 6px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .shelf-progress-label {
        font-size: 12px;
        color: #2563eb;
        transition: font-size 0.28s ease;
      }

      .shelf-progress-track {
        width: 100%;
        height: 4px;
        border-radius: 999px;
        background: #e5e7eb;
        overflow: hidden;
        transition: height 0.28s ease;
      }

      .shelf-progress-value {
        height: 4px;
        border-radius: 999px;
        background: #3b82f6;
        transition: height 0.28s ease;
      }

      .shelf-grid-card {
        display: flex;
        flex-direction: column;
        width: var(--shelf-grid-item-width);
        transition: width 0.28s ease, transform 0.28s ease, filter 0.28s ease;
        will-change: width, transform;
        animation: shelf-grid-relayout-a 0.32s ease both;
      }

      .shelf-grid-cover {
        position: relative;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid rgba(15, 23, 42, 0.06);
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
        transition: transform 0.2s ease, box-shadow 0.2s ease;

        img {
          width: 100%;
          height: auto;
          aspect-ratio: 3 / 4;
          object-fit: cover;
          display: block;
        }
      }

      .shelf-grid-card:hover .shelf-grid-cover {
        transform: translateY(-2px);
        box-shadow: 0 14px 28px rgba(15, 23, 42, 0.18);
      }

      @keyframes shelf-grid-relayout-a {
        from {
          opacity: 0.88;
          transform: translateY(4px) scale(0.985);
          filter: saturate(0.9);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
          filter: saturate(1);
        }
      }

      @keyframes shelf-grid-relayout-b {
        from {
          opacity: 0.9;
          transform: translateY(3px) scale(0.988);
          filter: saturate(0.92);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
          filter: saturate(1);
        }
      }

      @keyframes shelf-grid-relayout-c {
        from {
          opacity: 0.92;
          transform: translateY(2px) scale(0.992);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .shelf-grid-progress-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.62), rgba(0, 0, 0, 0.35));
        backdrop-filter: blur(2px);
        color: #fff;
        font-size: 10px;
        padding: 4px 6px;
        box-sizing: border-box;
      }

      .shelf-grid-title {
        margin-top: 8px;
        font-size: 14px;
        line-height: 1.4;
        font-weight: 600;
        color: #1f2937;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      }

      /* 断点分段：列宽只增不减，宽度增加时自动增加列数 */
      @media (min-width: 980px) {
        .bookcase-body--grid {
          --shelf-grid-item-width: 156px;
        }

        .bookcase-body--grid .shelf-grid-card {
          animation-name: shelf-grid-relayout-b;
        }
      }

      @media (min-width: 1180px) {
        .bookcase-body--grid {
          --shelf-grid-item-width: 166px;
        }

        .bookcase-body--grid .shelf-grid-card {
          animation-name: shelf-grid-relayout-c;
        }
      }

      @media (min-width: 1400px) {
        .bookcase-body--grid {
          --shelf-grid-item-width: 178px;
        }

        .bookcase-body--grid .shelf-grid-card {
          animation-name: shelf-grid-relayout-a;
        }
      }

      @media (min-width: 1660px) {
        .bookcase-body--grid {
          --shelf-grid-item-width: 192px;
        }

        .bookcase-body--grid .shelf-grid-card {
          animation-name: shelf-grid-relayout-b;
        }
      }

      /* 小宽度兜底：避免极窄窗口导致卡片溢出 */
      @media (max-width: 520px) {
        .bookcase-body--grid {
          --shelf-grid-item-width: 132px;
          --shelf-grid-gap: 14px;
        }

        .bookcase-body--grid .shelf-grid-card {
          animation-name: shelf-grid-relayout-c;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .bookcase-body--grid,
        .shelf-grid-card,
        .shelf-grid-cover {
          transition: none;
          animation: none;
        }
      }

      @media (min-width: 1260px) {
        .bookcase-body--list {
          gap: 18px;
        }

        .bookcase-body--list .shelf-list-card {
          padding: 20px;
          border-radius: 14px;
        }

        .bookcase-body--list .shelf-list-cover {
          width: 84px;
          height: 112px;
          border-radius: 12px;
        }

        .bookcase-body--list .shelf-list-content {
          padding-right: 88px;
          gap: 6px;
        }

        .bookcase-body--list .shelf-list-title {
          font-size: 18px;
        }

        .bookcase-body--list .shelf-list-author {
          top: 16px;
          right: 16px;
          max-width: 72px;
          padding: 2px 8px;
          font-size: 12px;
        }
      }

      @media (min-width: 1720px) {
        .bookcase-body--list {
          gap: 22px;
        }

        .bookcase-body--list .shelf-list-card {
          padding: 24px;
          border-radius: 16px;
        }

        .bookcase-body--list .shelf-list-cover {
          width: 96px;
          height: 128px;
          border-radius: 14px;
        }

        .bookcase-body--list .shelf-list-content {
          padding-right: 112px;
          gap: 8px;
        }

        .bookcase-body--list .shelf-list-title {
          font-size: 20px;
        }

        .bookcase-body--list .shelf-list-subtitle,
        .bookcase-body--list .shelf-list-meta,
        .bookcase-body--list .shelf-progress-label {
          font-size: 13px;
        }

        .bookcase-body--list .shelf-list-author {
          top: 18px;
          right: 18px;
          max-width: 92px;
          padding: 4px 12px;
          font-size: 14px;
        }

        .bookcase-body--list .shelf-progress-track,
        .bookcase-body--list .shelf-progress-value {
          height: 5px;
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

