<template>
  <div class="main-content">
    <!-- 加载遮罩 -->
    <Transition name="loading">
      <loadingBlockade v-if="isLoading" class="loading" :warn-text="loadingText" />
    </Transition>
    <!-- 自定义右键菜单 -->
    <ContextMenu v-model:show="showMenu" :menu-data="menuOptions" />
    <!-- 书籍信息弹窗 -->
    <BookInfoDialog v-model="bookInfoVisible" :book-key="bookInfoKey" />
    <CloudSyncDialog v-model="cloudSyncVisible" @synced="handleCloudSyncSynced" />
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
      <SettingDialog v-model="settingVisible" @close-dialog="settingVisible = false" />
    </header>
    <div class="book-list">
      <el-divider border-style="dashed" />
      <el-empty
        v-if="!booksLoading && isBooksEmpty"
        :image="emptyStateImage"
        image-size="160px"
        description="点击添加书籍吧"
        class="book-empty-state"
        @click="addBook"
      />
      <div v-else class="bookcase">
        <div v-if="booksLoading" class="bookcase-placeholder">正在加载书架数据...</div>
        <div
          v-else
          class="bookcase-body"
          :class="shelfViewMode === 'list' ? 'bookcase-body--list' : 'bookcase-body--grid'"
        >
          <div
            v-for="book in books"
            :key="book.bookKey"
            class="shelf-item"
            :class="shelfViewMode === 'list' ? 'shelf-list-card' : 'shelf-grid-card'"
            @click="openBook(book.bookKey)"
            @contextmenu="onContextMenu($event, book.bookKey)"
          >
            <div v-if="shelfViewMode === 'list'" class="shelf-list-cover">
              <img :src="getBookCover(book.cover)" alt="封面" />
              <span class="book-format-badge">
                {{ getBookFormatBadge(book) }}
              </span>
            </div>
            <div v-if="shelfViewMode === 'list'" class="shelf-list-content">
              <span
                v-if="isBookMissing(book)"
                class="shelf-list-missing-badge app-status-pill app-status-pill--danger"
              >
                书籍缺失
              </span>
              <div
                v-if="book.author"
                class="shelf-list-author"
                :class="{ 'shelf-list-author--missing': isBookMissing(book) }"
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

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import loadingBlockade from '@/components/common/LoadingBlockade/index.vue'
import ContextMenu from '@/components/ContextMenu/index.vue'
import AppIcon from '@/components/common/AppIcon/index.vue'
import type { BookFormat } from '@/types/book'
import type { ContextMenuData, ContextMenuItem } from '@/types/contextMenu'
import emptyStateImage from '@/assets/images/empty.png'
import SettingDialog from '@/components/SettingDialog/index.vue'
import BookInfoDialog from '@/components/BookInfoDialog/index.vue'
import CloudSyncDialog from '@/components/CloudSyncDialog/index.vue'
import defaultCover from '@/assets/default-cover.png'
import { detectBookFormatFromPath } from '@/services/book/bookFormatService'
import { buildBookConfigFromImport } from '@/services/book/bookImportService'
import { getLocalDirNames } from '@/services/fileSystem/dirService'
import type { LocalDirNames } from '@/services/fileSystem/dirService'
import {
  parseBookCoverInBackground,
  primeBookLocationsAfterImport,
  resolveBookCoverForDisplay,
  removeBookCacheDir,
} from '@/services/book/bookCacheService'
import {
  buildLastReadLabel,
  normalizeDisplayedChapterTitle,
} from '@/services/book/bookPresentationService'
import {
  useShelfBooksService,
  type ShelfBook,
  type ShelfBookFormat,
} from '@/services/book/shelfBooksService'
import {
  getImportedBookName,
  hasOriginalFilenameConflict,
  invalidateBookFileCache,
  loadBookConfigs,
  removeStoredBook,
  resolveBookFile,
  resolveBookFormat,
  upsertStoredBook,
  uploadLocalBookFileToCloud,
} from '@/services/book/bookRepository'
import type { StoredBookConfig } from '@/services/book/bookRepository'
import type { StoredBookRecord } from '@/services/book/bookRepositoryTypes'
import { readLocalBookFile } from '@/services/book/bookFileAccessService'
import { removeBookMarksByBookKey } from '@/services/book/bookMarksRepository'
import { toBookConfigFilename } from '@/services/book/bookIdentity'
import { normalizeBookConfig } from '@/services/book/bookConfigService'
import {
  buildLocalFilePath,
  CLOUD_DIRS,
  LOCAL_DIRS,
  removeLocalFile,
  writeJsonFile,
} from '@/services/fileSystem/localStorageService'
import {
  createMainTaskBatchNotifier,
  showMainTaskMessage,
} from '@/services/notification/mainTaskMessageService'
import { openReaderWindowWithPrecheck } from '@/services/reader/readerWindowLaunchService'
import type { BookshelfProgressSavedPayload } from '@/services/reader/readerWindowBridgeService'
import { buildContextMenuData } from '@/services/reader/contextMenuService'
import { getAppliedAppThemeMode } from '@/services/theme/themeService'
import { WINDOW_EVENTS } from '@/constants/events'
import { createDurationLogger, logError, logInfo, logWarn } from '@/utils/logger'
import { getFileNameFromPath } from '@/utils/filePath'
import { stringifyJson } from '@/utils/json'
import { formatCloudSyncResultMessage } from '@/services/sync/cloudSyncService'
import type { CloudSyncApplyResult } from '@/types/sync'

defineOptions({
  name: 'MainContent',
})

// ============================================================
// 类型声明
// ============================================================
type ShelfViewMode = 'list' | 'grid'
type ImportSourceFormat = BookFormat | 'txt'

// ============================================================
// 接口声明
// ============================================================
interface BatchImportContext {
  batchNotifier: ReturnType<typeof createMainTaskBatchNotifier>
  dirs: LocalDirNames
  reservedBookKeys: Set<string>
  reservedOriginalFileNames: Set<string>
}

// ============================================================
// 常量
// ============================================================
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

// ============================================================
// 核心数据状态
// ============================================================
const shelfBooks = useShelfBooksService()
const { books, isBooksEmpty } = shelfBooks
const booksLoading = ref(true)

// ============================================================
// 全局加载状态
// ============================================================
const isLoading = ref(false)
const loadingText = ref(
  'Police line do not cross - Police line do not cross - Police line do not cross - Police line do not cross - Police line do not cross - Police line do not cross',
)
const activeLoadingTasks = ref(0)

// ============================================================
// 弹窗状态
// ============================================================
const settingVisible = ref(false)
const bookInfoVisible = ref(false)
const cloudSyncVisible = ref(false)
const bookInfoKey = ref<string>('')

// ============================================================
// 右键菜单状态
// ============================================================
const showMenu = ref(false)
const menuOptions = ref({} as ContextMenuData)

// ============================================================
// 书架视图状态
// ============================================================
const shelfViewMode = ref<ShelfViewMode>(
  localStorage.getItem('shelfViewMode') === 'grid' ? 'grid' : 'list',
)

// ============================================================
// 事件解绑句柄
// ============================================================
let unlistenBookshelfProgressSaved: UnlistenFn | null = null
let unlistenCloudSyncFailed: UnlistenFn | null = null

// ============================================================
// 通用工具函数
// ============================================================
const toTaskErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return '发生未知异常'
}

const normalizeOriginalFileName = (fileName: string) => fileName.toLowerCase()

const runWithConcurrencyLimit = async <T,>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
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
    }),
  )
}

// ============================================================
// 加载状态控制
// ============================================================
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

// ============================================================
// 书架视图控制
// ============================================================
const toggleShelfViewMode = () => {
  shelfViewMode.value = shelfViewMode.value === 'list' ? 'grid' : 'list'
  localStorage.setItem('shelfViewMode', shelfViewMode.value)
}

// ============================================================
// 导入格式处理
// ============================================================
const detectImportSourceFormat = (path: string): ImportSourceFormat | null => {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'txt') {
    return 'txt'
  }

  return detectBookFormatFromPath(path)
}

const toEpubFileName = (fileName: string): string => {
  const lastDotIndex = fileName.lastIndexOf('.')
  const stem = lastDotIndex >= 0 ? fileName.slice(0, lastDotIndex) : fileName

  return `${stem || fileName}.epub`
}

// ============================================================
// 导入失败清理
// ============================================================
const cleanupImportedBookArtifacts = async (
  originalFileName: string,
  bookKey: string | null,
  removeBookArtifacts: boolean,
) => {
  const cleanupTasks: Promise<unknown>[] = [
    removeLocalFile(buildLocalFilePath(LOCAL_DIRS.books, originalFileName)),
  ]

  if (bookKey && removeBookArtifacts) {
    cleanupTasks.push(
      removeLocalFile(buildLocalFilePath(LOCAL_DIRS.progress, toBookConfigFilename(bookKey))),
      removeBookCacheDir(bookKey),
    )
  }

  const cleanupResults = await Promise.allSettled(cleanupTasks)
  const rejectedResults = cleanupResults.filter((result) => result.status === 'rejected')

  if (bookKey && removeBookArtifacts) {
    await removeStoredBook(bookKey).catch((error) => {
      logWarn('bookshelf', 'cleanup-import-artifacts remove-book-record-failed', {
        bookKey,
        fileName: originalFileName,
        error,
      })
    })
    invalidateBookFileCache()
  }

  if (rejectedResults.length > 0) {
    logWarn('bookshelf', 'cleanup-import-artifacts partial-failed', {
      bookKey,
      fileName: originalFileName,
      failedCount: rejectedResults.length,
    })
  }
}

// ============================================================
// 书架数据加载
// ============================================================
const buildShelfBook = async (storedBook: StoredBookConfig): Promise<ShelfBook> => {
  const { bookKey, config: book, record } = storedBook
  try {
    const format = await resolveBookFormat(bookKey)
    const progressValue = clampProgressValue(record.progress)

    const shelfBook = {
      ...book,
      bookKey,
      displayTitle: record.title || book.name,
      cover: await resolveBookCoverForDisplay(record, defaultCover, {
        onCoverUpdated: refreshShelfBookCover,
      }),
      format,
      progressValue,
      lastReadLabel: buildLastReadLabel(book, progressValue),
    }

    logInfo('bookshelf', 'build-shelf-book:done', {
      bookKey,
      format,
      progressValue,
    })
    return shelfBook
  } catch (error) {
    logWarn('bookshelf', 'build-shelf-book unresolved-file', {
      bookKey,
      error,
    })

    const shelfBook = {
      ...book,
      bookKey,
      displayTitle: record.title || book.name,
      cover: await resolveBookCoverForDisplay(record, defaultCover, {
        onCoverUpdated: refreshShelfBookCover,
      }),
      format: 'unknown' as ShelfBookFormat,
      progressValue: clampProgressValue(record.progress),
      lastReadLabel: '',
    }

    logInfo('bookshelf', 'build-shelf-book:done', {
      bookKey,
      format: 'unknown',
      progressValue: 0,
    })
    return shelfBook
  }
}

const refreshShelfBookCover = async (record: StoredBookRecord) => {
  const shelfBook = shelfBooks.getShelfBook(record.bookKey)
  if (!shelfBook) {
    return
  }

  shelfBooks.upsertShelfBook({
    ...shelfBook,
    cover: await resolveBookCoverForDisplay(record, defaultCover),
  })
}

const loadBooks = async () => {
  const finishLog = createDurationLogger('bookshelf', 'load-books')
  try {
    booksLoading.value = true
    const loadedBooks = await loadBookConfigs()
    shelfBooks.setShelfBooks(await Promise.all(loadedBooks.map((book) => buildShelfBook(book))))
    finishLog({
      total: books.value.length,
    })
  } catch (error) {
    logError('bookshelf', 'load-books failed', error)
  } finally {
    booksLoading.value = false
  }
}

// ============================================================
// 云同步业务
// ============================================================
const handleCloudSyncSynced = async (result: CloudSyncApplyResult) => {
  const finishLog = createDurationLogger('bookshelf', 'sync-files')
  beginLoading(IMPORT_LOADING_TEXT.syncing)
  try {
    cloudSyncVisible.value = false
    invalidateBookFileCache()
    await loadBooks()
    showMainTaskMessage({
      type: 'success',
      title: '云同步完成',
      message: formatCloudSyncResultMessage(result),
      taskKey: 'bookshelf-sync',
    })
    finishLog({
      ...result,
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

const syncFiles = () => {
  cloudSyncVisible.value = true
}

// ============================================================
// 书籍导入业务
// ============================================================
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
      addBookByPath(path, batchContext),
    )
  } finally {
    batchNotifier.flushWhenComplete()
  }
}

const addBookByPath = async (path: string, batchContext: BatchImportContext) => {
  const sourceFileName = getFileNameFromPath(path)
  const sourceFormat = detectImportSourceFormat(path)
  if (!sourceFormat) {
    logWarn('bookshelf', 'unsupported-book-format', {
      path,
    })
    return
  }

  let originalFileName = sourceFormat === 'txt' ? toEpubFileName(sourceFileName) : sourceFileName
  const normalizedOriginalFileName = normalizeOriginalFileName(originalFileName)
  const format: BookFormat = 'epub'

  if (batchContext.reservedOriginalFileNames.has(normalizedOriginalFileName)) {
    logWarn('bookshelf', 'duplicate-batch-file-name-detected', {
      fileName: sourceFileName,
      path,
    })
    return
  }

  const finishLog = createDurationLogger('bookshelf', 'import-book', {
    fileName: sourceFileName,
    sourceFormat,
    format,
  })
  batchContext.reservedOriginalFileNames.add(normalizedOriginalFileName)
  let reservedBookKey: string | null = null
  let importedBookKey: string | null = null
  let localCopyCreated = false
  let createdBookArtifacts = false
  let importSucceeded = false
  beginLoading(IMPORT_LOADING_TEXT.parsing)

  try {
    if (await hasOriginalFilenameConflict(originalFileName)) {
      logWarn('bookshelf', 'duplicate-file-name-detected', {
        fileName: originalFileName,
      })
      return
    }

    if (sourceFormat === 'txt') {
      originalFileName = await invoke<string>('convert_txt_to_epub', {
        filepath: path,
        subdir: batchContext.dirs.books,
        filename: sourceFileName,
      })
    } else {
      await invoke('copy_file_to_subdir', {
        filepath: path,
        subdir: batchContext.dirs.books,
        filename: originalFileName,
      })
    }
    localCopyCreated = true

    const fileBytes = await readLocalBookFile(originalFileName)
    const bufferFile = fileBytes.buffer.slice(
      fileBytes.byteOffset,
      fileBytes.byteOffset + fileBytes.byteLength,
    ) as ArrayBuffer
    const importedBook = await getImportedBookName(originalFileName, bufferFile)
    importedBookKey = importedBook.bookKey

    if (
      batchContext.reservedBookKeys.has(importedBook.bookKey) ||
      shelfBooks.hasShelfBook(importedBook.bookKey)
    ) {
      logWarn('bookshelf', 'duplicate-book-detected', {
        bookKey: importedBook.bookKey,
        fileName: originalFileName,
      })
      return
    }
    batchContext.reservedBookKeys.add(importedBook.bookKey)
    reservedBookKey = importedBook.bookKey
    let newBook = await buildBookConfigFromImport({
      sourcePath: path,
      originalFileName,
      format,
      fileBuffer: bufferFile,
    })
    const configFilename = toBookConfigFilename(importedBook.bookKey)
    let usedCloudConfig = false

    try {
      const existsOnCloud = await invoke('webdav_exists', {
        subdir: CLOUD_DIRS.progress,
        filename: configFilename,
      })
      if (existsOnCloud) {
        const cloudData = await invoke('webdav_get', {
          subdir: CLOUD_DIRS.progress,
          filename: configFilename,
        })
        const cloudConfig = normalizeBookConfig(
          JSON.parse(new TextDecoder().decode(new Uint8Array(cloudData as number[]))),
        )
        newBook = cloudConfig
        usedCloudConfig = true
        logInfo('bookshelf', 'import-book use-cloud-config', {
          bookKey: importedBook.bookKey,
          fileName: configFilename,
        })
      }
    } catch (error) {
      logWarn('bookshelf', 'import-book check-cloud-config-failed', {
        bookKey: importedBook.bookKey,
        error,
      })
    }

    const bookConfigJson = stringifyJson(newBook)
    const encodedBookConfig = new TextEncoder().encode(bookConfigJson)

    updateLoadingText(IMPORT_LOADING_TEXT.saving)

    await writeJsonFile(buildLocalFilePath(LOCAL_DIRS.progress, configFilename), newBook)
    createdBookArtifacts = true

    void primeBookLocationsAfterImport(importedBook.bookKey, bufferFile, originalFileName).catch(
      (error) => {
        logWarn('bookshelf', 'prime-epub-locations-cache failed', {
          bookKey: importedBook.bookKey,
          fileName: originalFileName,
          error,
        })
      },
    )

    const storedBook = await upsertStoredBook({
      bookKey: importedBook.bookKey,
      title: newBook.name,
      author: newBook.author,
      fileName: originalFileName,
      format,
      progress: 0,
    })

    invalidateBookFileCache()

    shelfBooks.upsertShelfBook({
      ...newBook,
      bookKey: importedBook.bookKey,
      displayTitle: newBook.name,
      cover: defaultCover,
      format,
      progressValue: 0,
      lastReadLabel: '未读',
    })
    parseBookCoverInBackground(storedBook, {
      onCoverUpdated: refreshShelfBookCover,
    })

    updateLoadingText(IMPORT_LOADING_TEXT.uploading)

    const bookLabel = newBook.name || importedBook.name
    batchContext.batchNotifier.registerTask(bookLabel)
    if (!usedCloudConfig) {
      queueMicrotask(() => {
        void Promise.allSettled([
          invoke('webdav_upload', {
            subdir: batchContext.dirs.progress,
            filename: configFilename,
            contents: Array.from(encodedBookConfig),
          }),
        ]).then((results) => {
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
    } else {
      batchContext.batchNotifier.recordSuccess(bookLabel)
    }
    importSucceeded = true
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
    if (localCopyCreated && !importSucceeded) {
      await cleanupImportedBookArtifacts(originalFileName, importedBookKey, createdBookArtifacts)
    }
    endLoading()
  }
}

// ============================================================
// 书籍删除业务
// ============================================================
const deleteBook = async (bookKey: string) => {
  const finishLog = createDurationLogger('bookshelf', 'delete-book', {
    bookKey,
  })
  try {
    const targetBook = shelfBooks.getShelfBook(bookKey)
    const resolvedBookFile = targetBook ? await resolveBookFile(bookKey).catch(() => null) : null

    await removeLocalFile(buildLocalFilePath(LOCAL_DIRS.progress, toBookConfigFilename(bookKey)))

    if (resolvedBookFile) {
      await removeLocalFile(buildLocalFilePath(LOCAL_DIRS.books, resolvedBookFile.fileName))
    }

    if (targetBook) {
      await removeBookCacheDir(targetBook.bookKey)
    }

    await removeBookMarksByBookKey(bookKey)
    await removeStoredBook(bookKey)

    invalidateBookFileCache()
    shelfBooks.removeShelfBook(bookKey)
    showMenu.value = false

    queueMicrotask(() => {
      void Promise.allSettled([
        invoke('webdav_delete', {
          subdir: CLOUD_DIRS.progress,
          filename: toBookConfigFilename(bookKey),
        }),
        ...(resolvedBookFile
          ? [
              invoke('webdav_delete', {
                subdir: CLOUD_DIRS.books,
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

// ============================================================
// 阅读窗口业务
// ============================================================
const openBook = async (bookKey: string) => {
  await openReaderWindowWithPrecheck(bookKey.toString())
}

// ============================================================
// 阅读进度同步
// ============================================================
const clampProgressValue = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, value))
}

const applyBookshelfProgressSaved = (payload: BookshelfProgressSavedPayload) => {
  if (!payload.bookKey) {
    return
  }

  const currentBook = shelfBooks.getShelfBook(payload.bookKey)
  if (!currentBook) {
    void loadBooks()
    return
  }

  const progressValue = clampProgressValue(payload.progress)
  shelfBooks.upsertShelfBook({
    ...currentBook,
    durChapterIndex: payload.durChapterIndex,
    durChapterPos: payload.durChapterPos,
    durChapterTitle: payload.durChapterTitle,
    durChapterTime: payload.durChapterTime,
    progressValue,
    lastReadLabel: buildLastReadLabel(
      {
        durChapterIndex: payload.durChapterIndex,
        durChapterPos: payload.durChapterPos,
        durChapterTitle: payload.durChapterTitle,
        durChapterTime: payload.durChapterTime,
      },
      progressValue,
    ),
  })
}

// ============================================================
// 事件绑定
// ============================================================
const registerBookshelfProgressSavedListener = async () => {
  unlistenBookshelfProgressSaved?.()
  unlistenBookshelfProgressSaved = await listen<BookshelfProgressSavedPayload>(
    WINDOW_EVENTS.BOOKSHELF_PROGRESS_SAVED,
    (event) => {
      applyBookshelfProgressSaved(event.payload)
    },
  )
}

const registerCloudSyncFailedListener = async () => {
  unlistenCloudSyncFailed?.()
  unlistenCloudSyncFailed = await listen<{ bookKey?: string; fileName?: string }>(
    WINDOW_EVENTS.CLOUD_SYNC_FAILED,
    () => {
      showMainTaskMessage({
        type: 'warning',
        title: '云同步失败',
        message: '阅读进度已保存至本地，但云端同步失败，请检查网络连接。',
        taskKey: 'bookshelf-cloud-sync-failed',
      })
    },
  )
}

// ============================================================
// 云端上传业务
// ============================================================
const uploadBookToCloud = async (bookKey: string) => {
  try {
    await uploadLocalBookFileToCloud(bookKey)
    showMainTaskMessage({
      type: 'success',
      title: '上传完成',
      message: '书籍文件已上传至云端。',
      taskKey: `bookshelf-upload:${bookKey}`,
    })
  } catch (error) {
    showMainTaskMessage({
      type: 'error',
      title: '上传失败',
      message: toTaskErrorMessage(error),
      taskKey: `bookshelf-upload:${bookKey}`,
    })
  }
}

// ============================================================
// 书籍信息弹窗
// ============================================================
const showBookInfo = (bookKey: string) => {
  bookInfoKey.value = bookKey.toString()
  bookInfoVisible.value = true
}

// ============================================================
// 右键菜单业务
// ============================================================
const onContextMenu = (e: MouseEvent, bookKey: string) => {
  const menuItems: ContextMenuItem[] = [
    {
      label: '打开 | 开始阅读',
      type: 'bookOpen',
      onClick: () => void openBook(bookKey),
    },
    {
      label: '上传 | 上传到云端',
      type: 'upload',
      onClick: () => void uploadBookToCloud(bookKey),
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
  menuOptions.value = buildContextMenuData({
    x: e.x,
    y: e.y,
    menuItems,
    width: 170,
    itemHeight: 35,
    precision: 20,
    theme: getAppliedAppThemeMode(),
  })
  showMenu.value = true
}

// ============================================================
// 设置弹窗
// ============================================================
const openSetting = () => {
  settingVisible.value = true
}

// ============================================================
// 书架展示格式化
// ============================================================
const getBookCover = (cover?: string) => {
  if (cover && (cover.startsWith('asset:') || cover.startsWith('http://asset.localhost'))) {
    return cover
  }

  return defaultCover
}

const getBookFormatBadge = (book: ShelfBook): string => {
  if (book.format === 'unknown') {
    return '--'
  }

  return 'EPUB'
}

const isBookMissing = (book: ShelfBook): boolean => {
  return book.format === 'unknown'
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
  return normalizeDisplayedChapterTitle(book.durChapterTitle)
}

const getListMeta = (book: ShelfBook): string => {
  return `最近阅读：${book.lastReadLabel}`
}

// ============================================================
// 生命周期
// ============================================================
onMounted(() => {
  void loadBooks()
  void registerBookshelfProgressSavedListener().catch((error) => {
    logWarn('bookshelf', 'register bookshelf-progress listener failed', error)
  })
  void registerCloudSyncFailedListener().catch((error) => {
    logWarn('bookshelf', 'register cloud-sync-failed listener failed', error)
  })
})

onUnmounted(() => {
  unlistenBookshelfProgressSaved?.()
  unlistenBookshelfProgressSaved = null
  unlistenCloudSyncFailed?.()
  unlistenCloudSyncFailed = null
})
</script>

<style lang="scss" scoped>
.main-content {
  flex: 1;
  padding: 20px 0 20px 0;
  overflow: hidden;
  user-select: none;
  background: var(--app-bg-accent);
  color: var(--text-primary);

  .header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 10px 0;

    .header-menu {
      padding: 0.5rem;
      background-color: var(--surface-strong);
      border: 1px solid var(--border-default);
      position: relative;
      display: flex;
      justify-content: center;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      backdrop-filter: blur(12px);

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
          content: '';
          display: block;
          border-radius: var(--radius-sm);
          width: 100%;
          height: 100%;
          top: 0;
          transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          transform-origin: center right;
          background-color: var(--surface-card-soft);
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
          color: var(--text-secondary);
        }
      }
      &-label {
        transform: translateX(100%);
        transition:
          transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
          opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
      background-color: var(--scrollbar-thumb);
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

    :deep(.el-empty) {
      flex: 1;
      cursor: var(--t-mouse-cursor-link), pointer;
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
              content: '';
              position: absolute;
              left: 0;
              bottom: 0;
              width: 0;
              height: 2px;
              background: var(--t-color-light-yellow);
              transition: width 0.2s ease-in;
            }
          }
          .book-author {
            background: var(--t-color-light-blue);
            color: var(--text-on-brand);
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

            span:first-child {
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
          background-color: var(--scrollbar-thumb);
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
        color: var(--text-tertiary);
        font-size: 14px;
      }

      .shelf-list-card {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 16px;
        position: relative;
        background: var(--surface-strong);
        border-radius: var(--radius-sm);
        padding: 12px;
        border: 1px solid var(--border-default);
        box-shadow: var(--shadow-sm);
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease,
          padding 0.28s ease,
          border-radius 0.28s ease;

        &:hover {
          transform: translateY(2px);
          box-shadow: var(--shadow-md);
        }
      }

      .shelf-list-cover {
        position: relative;
        flex: 0 0 auto;
        width: 90px;
        height: 120px;
        border-radius: 10px;
        overflow: hidden;
        transition:
          width 0.28s ease,
          height 0.28s ease,
          border-radius 0.28s ease;

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
        color: var(--text-on-brand);
        background: var(--surface-overlay-strong);
        font-size: 10px;
        line-height: 1;
        padding: 4px 6px;
      }

      .shelf-list-missing-badge {
        position: absolute;
        top: 12px;
        right: 12px;
      }

      .shelf-list-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding-right: 72px;
        transition:
          padding-right 0.28s ease,
          gap 0.28s ease;
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
        background: var(--brand-primary);
        color: var(--text-on-brand);
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

      .shelf-list-author--missing {
        top: 38px;
      }

      .shelf-list-author:hover {
        transform: translateY(-1px);
        background: var(--brand-primary-hover);
      }

      .shelf-list-title {
        width: fit-content;
        font-size: 16px;
        line-height: 1.35;
        font-weight: 700;
        color: var(--text-primary);
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
          content: '';
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
          color: var(--text-on-brand);
        }

        span::after {
          opacity: 0;
        }
      }

      .shelf-list-subtitle,
      .shelf-list-meta {
        font-size: 12px;
        color: var(--text-tertiary);
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
        color: var(--brand-primary);
        transition: font-size 0.28s ease;
      }

      .shelf-progress-track {
        width: 100%;
        height: 4px;
        border-radius: 999px;
        background: var(--surface-inset);
        overflow: hidden;
        transition: height 0.28s ease;
      }

      .shelf-progress-value {
        height: 4px;
        border-radius: 999px;
        background: var(--brand-primary);
        transition: height 0.28s ease;
      }

      .shelf-grid-card {
        display: flex;
        flex-direction: column;
        width: var(--shelf-grid-item-width);
        transition:
          width 0.28s ease,
          transform 0.28s ease,
          filter 0.28s ease;
        will-change: width, transform;
        animation: shelf-grid-relayout-a 0.32s ease both;
      }

      .shelf-grid-cover {
        position: relative;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid var(--border-soft);
        box-shadow: var(--shadow-md);
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease;

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
        box-shadow: var(--shadow-lg);
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
        background: var(--surface-overlay-gradient);
        backdrop-filter: blur(2px);
        color: var(--text-on-brand);
        font-size: 10px;
        padding: 4px 6px;
        box-sizing: border-box;
      }

      .shelf-grid-title {
        margin-top: 8px;
        font-size: 14px;
        line-height: 1.4;
        font-weight: 600;
        color: var(--text-primary);
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
          padding: 16px;
          border-radius: 14px;
        }

        .bookcase-body--list .shelf-list-cover {
          width: 96px;
          height: 132px;
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

        .bookcase-body--list .shelf-list-missing-badge {
          top: 16px;
          right: 16px;
        }

        .bookcase-body--list .shelf-list-author--missing {
          top: 42px;
        }
      }

      @media (min-width: 1720px) {
        .bookcase-body--list {
          gap: 22px;
        }

        .bookcase-body--list .shelf-list-card {
          padding: 20px;
          border-radius: 16px;
        }

        .bookcase-body--list .shelf-list-cover {
          width: 108px;
          height: 144px;
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

        .bookcase-body--list .shelf-list-missing-badge {
          top: 18px;
          right: 18px;
        }

        .bookcase-body--list .shelf-list-author--missing {
          top: 46px;
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
