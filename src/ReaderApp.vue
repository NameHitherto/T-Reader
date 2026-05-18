<template>
  <div class="reader">
    <!-- EPUB 阅读器内容 -->
    <div id="epub-reader"></div>
    <!-- 翻页按钮 -->
    <div class="pagination">
      <button class="prev-page button" @click="prevPage">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 20 20"
        >
          <path fill="currentColor" d="m4 10l9 9l1.4-1.5L7 10l7.4-7.5L13 1z" />
        </svg>
      </button>
      <button class="next-page button" @click="nextPage">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 20 20"
        >
          <path fill="currentColor" d="M7 1L5.6 2.5L13 10l-7.4 7.5L7 19l9-9z" />
        </svg>
      </button>
    </div>
  </div>
  <el-drawer v-model="tocDrawer" direction="ltr" :show-close="false" @open="handleTocOpen">
    <template #header>
      <span class="drawer-title">目录</span>
    </template>
    <el-menu
      ref="tocMenuRef"
      :default-active="activeChapter"
      @select="goToChapter"
    >
      <template v-for="item in toc" :key="item.id || item.href">
        <toc-menu
          v-if="item.subitems?.length"
          :sub-toc="item"
        />
        <el-menu-item v-else :key="item.id" :index="item.href">
          {{ item.label }}
        </el-menu-item>
      </template>
    </el-menu>
  </el-drawer>
  <!-- 书籍详情信息 -->
  <book-info-dialog v-model="bookInfoVisible" :book-key="currentBookKey" />
  <!-- 右键菜单 -->
  <ContextMenu v-model:show="showContextMenu" :menu-data="contextMenuOptions" />
  <!-- 笔记编辑框 -->
  <BookMarkDialog
    v-model="bookMarkEditionVisible"
    v-model:book-mark-list="bookMarkEditionContent"
    @delete="(markId: string) => delBookMark(markId)"
  />
  <!-- AI 助手 -->
  <AssistantDialog v-model="assistantVisible" :book-key="currentBookKey" />
  <!-- 功能帮助 -->
  <HelpDialog v-model="helpVisible" />
  <SystemFontEnableDialog v-model="systemFontDialogVisible" />
  <Teleport to="body">
    <Transition
      name="style-menu"
      @enter="handleStyleMenuEnter"
      @after-enter="handleStyleMenuAfterEnter"
    >
      <div
        v-if="styleMenuVisible"
        id="customer-menu"
        ref="styleMenuPanelRef"
        class="style-menu-panel"
        :style="styleMenuPanelStyle"
      >
        <StyleMenu
          :max-height="styleMenuPosition.maxHeight"
          :theme-mode="appThemeMode"
          @open-font-dialog="handleOpenSystemFontDialog"
        />
      </div>
    </Transition>
  </Teleport>
  <!-- 阅读进度 -->
  <div v-if="readingStatusText" class="reading-status" :title="readingStatusText">
    {{ readingStatusText }}
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useReaderConfigStore } from './store/readerConfigStore'
import { storeToRefs } from 'pinia'
import { logInfo, logWarn, logError } from '@/utils/logger'
import BookInfoDialog from './components/BookInfoDialog/index.vue'
import ContextMenu from './components/ContextMenu/index.vue'
import BookMarkDialog from './components/BookMark/bookMarkDialog.vue'
import AssistantDialog from './components/AssistantDialog/index.vue'
import HelpDialog from './components/HelpDialog/index.vue'
import StyleMenu from './components/StyleMenu/index.vue'
import SystemFontEnableDialog from './components/SystemFontEnableDialog/index.vue'
import TocMenu from './components/TocMenu/index.vue'
import { BookConfig } from '@/types/book'
import { ContextMenuData, ContextMenuItem } from '@/types/contextMenu'
import { READER_DOM_EVENTS } from '@/constants/events'
import {
  destroyEpubRendition,
  renderEpubBook,
} from '@/services/reader/epub/epubAdapter'
import type { EpubBuiltInStylesheetIsolationController } from '@/services/reader/epub/epubBuiltinStylesheetIsolationService'
import { loadReaderBookData } from '@/services/reader/readerLoadService'
import { saveReaderProgress } from '@/services/reader/readerProgressService'
import { registerReaderWindowEvents } from '@/services/reader/readerWindowEventsService'
import {
  addBookmarkHighlight,
  initBookMarksForBook,
  removeBookmarkHighlight,
} from '@/services/reader/epub/bookmarkService'
import { bindRenditionEvents } from '@/services/reader/epub/renditionEventsService'
import {
  collectParentChapterIndexes,
  scrollDrawerToActiveChapter,
} from '@/services/reader/epub/tocService'
import { buildContextMenuData } from '@/services/reader/contextMenuService'
import {
  dispatchReaderKeydown,
  resetReaderTransientUi,
} from '@/services/reader/interactionService'
import { useBookmarkEditor } from '@/composables/useBookmarkEditor'
import { useBookMarkStore, BookMark } from './store/bookMark'
import { withReaderLoading } from '@/services/reader/readerLoadingService'
import {
  applyReaderStyles,
  ReaderStyleConfig,
} from '@/services/reader/readerStyleService'
import { serializeReaderThemeCss } from '@/services/reader/epub/epubStyleService'
import {
  loadReaderConfigFromDisk,
  saveReaderConfigToDisk,
} from '@/services/reader/readerConfigService'
import {
  fetchSystemFonts,
  normalizeReaderConfig,
} from '@/services/reader/systemFontService'
import { buildReaderFontApplication } from '@/services/reader/readerFontApplicationService'
import { primeBookCacheAfterImport } from '@/services/book/bookCacheService'
import { getReadyBookLocations } from '@/services/book/bookLocationsCacheService'
import { normalizeDisplayedChapterTitle } from '@/services/book/bookPresentationService'
import { loadBookMarksByBookKey } from '@/services/book/bookMarksRepository'
import { DEFAULT_BOOKMARK_HIGHLIGHT_COLOR } from '@/constants/bookmark'
import { resolveEpubTocLabel } from '@/services/reader/epub/epubProgressService'
import {
  getAppliedAppThemeMode,
  getReaderRuntimePalette,
  syncReaderConfigThemeColors,
} from '@/services/theme/themeService'
import type { AppThemeMode } from '@/services/settings/appSettingsService'
import type { EpubRenditionLike, EpubTocItem } from '@/types/epub'
import {
  ackReaderLoadMessage,
  dispatchBookshelfProgressSaved,
  notifyReaderWindowReady,
} from '@/services/reader/readerWindowBridgeService'
import { formatDate } from '@/utils/date'
import { generateID } from '@/utils/id'

// ============================================================
// 组件元信息
// ============================================================
defineOptions({ name: 'ReaderApp' })

// ============================================================
// 常量
// ============================================================
const STYLE_MENU_ESTIMATED_WIDTH = 324
const STYLE_MENU_LEFT_OFFSET = 12
const STYLE_MENU_SAFE_TOP = 56
const STYLE_MENU_SAFE_BOTTOM = 64

// ============================================================
// 核心状态：书籍 & EPUB 渲染
// ============================================================
const currentBookKey = ref<string | null>(null)
const pendingBookKey = ref<string | null>(null)
const bookInfoVisible = ref(false)
const rendition = ref<EpubRenditionLike | null>(null)
const currentBookConfig = ref<BookConfig | null>(null)
let stylesheetIsolationController: EpubBuiltInStylesheetIsolationController | null = null

// ============================================================
// 阅读配置 store
// ============================================================
const readerConfigStore = useReaderConfigStore()
const { readerConfig } = storeToRefs(readerConfigStore)

// ============================================================
// 主题
// ============================================================
const appThemeMode = ref<AppThemeMode>(getAppliedAppThemeMode())

const readerPalette = computed(() =>
  getReaderRuntimePalette(readerConfig.value, appThemeMode.value)
)
const readerFontApplication = computed(() =>
  buildReaderFontApplication(
    readerConfig.value.font,
    readerConfig.value.enabledSystemFonts
  )
)
const readerDefaultTheme = computed(() => {
  const columnStyle: Record<string, string> = {}
  if (readerConfig.value.flow === 'paginated') {
    Object.assign(columnStyle, {
      'column-width': 'auto !important',
      'column-gap': `${2 * readerConfig.value.boxPaddingHorizontal}px !important`,
      'column-count': `${readerConfig.value.columnCount}`,
    })
  }

  const themeReturned: Record<string, Record<string, string | number>> = {
    body: {
      'font-family': readerFontApplication.value.fontFamilyCss,
      'font-size': `${readerConfig.value.fontSize}px`,
      'font-weight': readerConfig.value.fontWeight,
      color: readerPalette.value.text,
      background: readerPalette.value.contentBackground,
      'background-color': readerPalette.value.contentBackground,
      'padding-top': `${readerConfig.value.boxPaddingTop}px !important`,
      'padding-bottom': `${readerConfig.value.boxPaddingBottom}px !important`,
      'padding-left': `${readerConfig.value.boxPaddingHorizontal}px !important`,
      'padding-right': `${readerConfig.value.boxPaddingHorizontal}px !important`,
      'min-height': '100%',
      ...columnStyle,
    },
    h1: {
      'font-family': readerFontApplication.value.fontFamilyCss,
      color: readerPalette.value.text,
    },
    h2: {
      'font-family': readerFontApplication.value.fontFamilyCss,
      color: readerPalette.value.text,
    },
    h3: {
      'font-family': readerFontApplication.value.fontFamilyCss,
      color: readerPalette.value.text,
    },
    p: {
      'font-family': readerFontApplication.value.fontFamilyCss,
      color: readerPalette.value.text,
      'line-height': `${readerConfig.value.lineSpacing}em`,
      'margin-bottom': `${readerConfig.value.paragraphSpacing}em`,
      'text-indent': `${readerConfig.value.indent}em`,
      'letter-spacing': `${readerConfig.value.letterSpacing}px`,
    },
    font: {
      'font-family': readerFontApplication.value.fontFamilyCss,
      color: readerPalette.value.text,
    },
    a: {
      color: readerPalette.value.link,
    },
    blockquote: {
      color: readerPalette.value.mutedText,
      'border-left': `3px solid ${readerPalette.value.selectionBackground}`,
    },
    '::selection': {
      background: readerPalette.value.selectionBackground,
      color: readerPalette.value.selectionColor,
    },
    html: {
      background: readerPalette.value.contentBackground,
      'background-color': readerPalette.value.contentBackground,
      cursor: `url('/src/assets/cursor/pointer.cur'), default`,
    },
    img: {
      width: '100%',
      filter: readerPalette.value.imageFilter,
    },
  }

  if (readerFontApplication.value.fontFaceThemeBlock) {
    themeReturned['@font-face'] = readerFontApplication.value.fontFaceThemeBlock
  }

  return themeReturned
})

async function applyReaderStyle(applyIframeStyle = true) {
  applyReaderStyles(
    readerConfig.value as ReaderStyleConfig,
    readerDefaultTheme.value,
    rendition.value,
    appThemeMode.value,
    applyIframeStyle
  )
}

// ============================================================
// 阅读配置持久化
// ============================================================
async function loadReaderConfig() {
  try {
    const [configTemp, systemFonts] = await Promise.all([
      loadReaderConfigFromDisk(),
      fetchSystemFonts().catch((error) => {
        logWarn('reader', '加载系统字体失败，将跳过阅读器字体迁移', error)
        return []
      }),
    ])

    const normalizedConfig = normalizeReaderConfig(configTemp, systemFonts)
    const themedConfig = syncReaderConfigThemeColors(normalizedConfig, appThemeMode.value)
    readerConfigStore.setReaderConfig(themedConfig)

    if (JSON.stringify(configTemp) !== JSON.stringify(themedConfig)) {
      await saveReaderConfigToDisk(themedConfig)
    }
  } catch {
    readerConfigStore.setDefaultConfig()
    readerConfigStore.setReaderConfig(
      syncReaderConfigThemeColors(readerConfig.value, appThemeMode.value)
    )
    logWarn('reader', 'ReaderConfig.json文件不存在，已加载默认配置')
  }
}

async function saveReaderConfig() {
  await saveReaderConfigToDisk(
    syncReaderConfigThemeColors(readerConfig.value, appThemeMode.value)
  )
}

// ============================================================
// 阅读进度
// ============================================================
const readingPercentage = ref('')
const readingChapterTitle = ref('')

const readingStatusText = computed(() => {
  if (!readingPercentage.value) return ''
  return `${normalizeDisplayedChapterTitle(readingChapterTitle.value)} · ${readingPercentage.value}%`
})

async function saveReaderRendition() {
  if (!currentBookKey.value) return

  const savedProgress = await saveReaderProgress({
    bookKey: currentBookKey.value,
    rendition: rendition.value,
    bookMarks: bookMarks.value,
  })

  if (savedProgress) {
    currentBookConfig.value = savedProgress.bookConfig

    await dispatchBookshelfProgressSaved({
      bookKey: currentBookKey.value,
      progress: savedProgress.progress,
      durChapterIndex: savedProgress.bookConfig.durChapterIndex,
      durChapterPos: savedProgress.bookConfig.durChapterPos,
      durChapterTitle: savedProgress.bookConfig.durChapterTitle,
      durChapterTime: savedProgress.bookConfig.durChapterTime,
    }).catch((error) => {
      logWarn('reader', '通知主窗口刷新书架失败', error)
    })
  }
}

// ============================================================
// 页面导航
// ============================================================
function prevPage() {
  if (rendition.value && readerConfig.value.flow === 'paginated') {
    rendition.value.prev?.()
  }
}

function nextPage() {
  if (rendition.value && readerConfig.value.flow === 'paginated') {
    rendition.value.next?.()
  }
}

async function switchFullscreen() {
  await invoke('window_toggle_fullscreen', { label: getCurrentWindow().label })
}

// ============================================================
// 键盘交互
// ============================================================
function keydownHandler(e: KeyboardEvent) {
  dispatchReaderKeydown(e, {
    onPrevPage: () => prevPage(),
    onNextPage: () => nextPage(),
    onToggleFullscreen: () => switchFullscreen(),
  })
}

// ============================================================
// 目录抽屉
// ============================================================
const tocDrawer = ref(false)
const tocMenuRef = ref<{ open: (index: string) => void } | null>(null)
const toc = ref<EpubTocItem[]>([])
const activeChapter = ref<string>('')

let detachTocButtonListener: (() => void) | null = null

function goToChapter(href: string) {
  if (rendition.value) {
    rendition.value.display(href)
    activeChapter.value = href
  }
  tocDrawer.value = false
}

function handleTocOpen() {
  const book = rendition.value?.book
  const indexGroup = collectParentChapterIndexes(book, activeChapter.value)

  if (tocMenuRef.value && typeof tocMenuRef.value.open === 'function') {
    for (const index of indexGroup) {
      tocMenuRef.value.open(index)
    }
  }
  scrollDrawerToActiveChapter(500)
}

function bindTocButtonClick() {
  detachTocButtonListener?.()
  detachTocButtonListener = null

  const tocButton = document.getElementById('titlebar-toc')
  if (!tocButton) return

  const handler = () => { tocDrawer.value = true }
  tocButton.addEventListener('click', handler)
  detachTocButtonListener = () => {
    tocButton.removeEventListener('click', handler)
  }
}

// ============================================================
// 右键菜单 & 选中文本
// ============================================================
const showContextMenu = ref(false)
const contextMenuOptions = ref({} as ContextMenuData)
const selectedText = ref<string>('')
const selectedRange = ref<string | null>(null)

function openContextMenu(mode: string, x: number, y: number, options: ContextMenuItem[]) {
  let menuX = 0
  let menuY = 0
  if (mode === 'root') {
    menuX = x
    menuY = y
  }
  contextMenuOptions.value = buildContextMenuData({
    x: menuX,
    y: menuY,
    menuItems: options,
    width: 160,
    itemHeight: 35,
    precision: 20,
    theme: appThemeMode.value,
  })
  showContextMenu.value = true
}

// ============================================================
// 书签
// ============================================================
const bookMarkStore = useBookMarkStore()
const { bookMarks } = storeToRefs(bookMarkStore)
const defaultHighlightColor = DEFAULT_BOOKMARK_HIGHLIGHT_COLOR

const {
  bookMarkEditionVisible,
  bookMarkEditionContent,
  openEditorByMarkId,
  closeEditor,
} = useBookmarkEditor({
  bookMarkStore,
  rendition,
  defaultHighlightColor,
})

function initAllBookMarks() {
  if (!currentBookKey.value) return

  initBookMarksForBook(
    rendition.value,
    bookMarks.value,
    currentBookKey.value,
    defaultHighlightColor
  )
}

async function addBookMark() {
  const tempId = generateID(3)
  const bookMark: BookMark = {
    id: tempId,
    bookName: currentBookKey.value ? currentBookKey.value : '',
    bookCfi: selectedRange.value ? selectedRange.value : '',
    bookTitle: (await rendition.value?.book?.loaded?.metadata)?.title || '未知书籍',
    content: selectedText.value,
    createTime: formatDate(new Date()),
  }
  bookMarkStore.addBookMark(bookMark)
  addBookmarkHighlight(
    rendition.value,
    selectedRange.value ? selectedRange.value : '',
    tempId,
    defaultHighlightColor
  )
  return tempId
}

async function addBookMarkComment() {
  const bookMarkId = await addBookMark()
  openEditorByMarkId(bookMarkId)
}

function delBookMark(markId: string) {
  const bookMark = bookMarkStore.getBookMark(markId)[0]
  removeBookmarkHighlight(rendition.value, bookMark.bookCfi)
  bookMarkStore.removeBookMark(markId)
  closeEditor()
}

// ============================================================
// 书籍加载
// ============================================================

function handleRenditionEvents() {
  if (!rendition.value) return

  bindRenditionEvents(rendition.value, {
    onRelocated: (location) => {
      const locationStart = location.start
      if (locationStart?.href) {
        activeChapter.value = locationStart.href
        readingChapterTitle.value =
          resolveEpubTocLabel(rendition.value?.book?.navigation?.toc, locationStart.href) ||
          normalizeDisplayedChapterTitle(currentBookConfig.value?.durChapterTitle)
      }
      const percentage = locationStart?.percentage
      if (percentage !== undefined && percentage !== null) {
        readingPercentage.value = (percentage * 100).toFixed(1)
      }
    },
    onSelected: (cfiRange, text) => {
      selectedText.value = text
      selectedRange.value = cfiRange
    },
    onKeyNavigatePrev: () => prevPage(),
    onKeyNavigateNext: () => nextPage(),
    onToggleFullscreen: () => switchFullscreen(),
    onReaderClick: () => {
      resetReaderTransientUi({
        hideContextMenu: () => { showContextMenu.value = false },
      })
    },
    onMarkClicked: (markId: string) => openEditorByMarkId(markId),
    openContextMenu: (x, y, menuItems) =>
      openContextMenu('root', x, y, menuItems as ContextMenuItem[]),
    buildContextMenuItems: () => [
      { label: '标记 | 添加书签', type: 'bookmark', onClick: () => addBookMark() },
      { label: '注释 | 个人评论', type: 'comment', onClick: () => addBookMarkComment() },
    ],
  })
}

async function loadBook(cfi?: string) {
  if (!pendingBookKey.value) {
    setTimeout(loadBook, 500)
    return
  }

  currentBookKey.value = pendingBookKey.value
  pendingBookKey.value = null

  await withReaderLoading(async () => {
    const loadedBook = await loadReaderBookData(currentBookKey.value as string)
    const { bookConfig, bookCache, bookLocationsCache, fileName, bookArrayBuffer } = loadedBook

    currentBookConfig.value = bookConfig
    readingPercentage.value = ''
    readingChapterTitle.value = normalizeDisplayedChapterTitle(bookConfig.durChapterTitle)
    bookMarkStore.clearBookMarks()

    if (rendition.value) {
      stylesheetIsolationController?.destroy()
      stylesheetIsolationController = null
      try {
        destroyEpubRendition(rendition.value)
      } catch (e) {
        logWarn('ReaderApp', '销毁旧的 Rendition 失败', e)
      }
      rendition.value = null
    }

    const epubBook = await renderEpubBook(
      bookArrayBuffer as ArrayBuffer,
      readerConfig.value.flow,
      readerConfig.value.loadEpubBuiltInStylesheet,
      cfi,
      bookConfig,
      getReadyBookLocations(bookLocationsCache),
      serializeReaderThemeCss(readerDefaultTheme.value)
    )
    rendition.value = epubBook.rendition
    stylesheetIsolationController = epubBook.stylesheetIsolation
    await applyReaderStyle(false)
    await rendition.value.display(epubBook.displayTarget)
    handleRenditionEvents()
    toc.value = epubBook.toc
    bindTocButtonClick()

    if (bookLocationsCache?.status !== 'ready') {
      queueMicrotask(() => {
        void primeBookCacheAfterImport(
          currentBookKey.value as string,
          bookArrayBuffer as ArrayBuffer,
          fileName
        ).catch((error) => {
          logWarn('ReaderApp', '补全 EPUB locations 缓存失败', error)
        })
      })
    }

    const currentBookMarks = await loadBookMarksByBookKey(currentBookKey.value as string)
    if (currentBookMarks.length > 0) {
      bookMarkStore.importBookMark(currentBookMarks)
      void initAllBookMarks()
    }

    logInfo('ReaderApp', 'loadBook', { bookKey: currentBookKey.value, title: bookCache?.title || bookConfig.name })
  }).catch((e) => {
    logError('ReaderApp', '书籍加载失败', e)
  })
}

// ============================================================
// 样式菜单
// ============================================================
const styleMenuVisible = ref(false)
const styleMenuPosition = ref({
  left: STYLE_MENU_LEFT_OFFSET,
  top: STYLE_MENU_SAFE_TOP,
  maxHeight: 320,
})
const styleMenuPanelRef = ref<HTMLElement | null>(null)

const styleMenuPanelStyle = computed(() => ({
  top: `${styleMenuPosition.value.top}px`,
  left: `${styleMenuPosition.value.left}px`,
}))

function getStyleMenuButton() {
  return document.getElementById('titlebar-customer') as HTMLElement | null
}

function setStyleMenuButtonActive(active: boolean) {
  getStyleMenuButton()?.classList.toggle('active', active)
}

function isStyleMenuRelatedTarget(target: HTMLElement | null) {
  if (!target) return false
  return !!(
    target.closest('#customer-menu') ||
    target.closest('#titlebar-customer') ||
    target.closest('.system-font-enable-dialog-wrapper') ||
    target.closest('.system-font-enable-dialog-overlay') ||
    target.closest('.el-popper')
  )
}

function computeStyleMenuPosition(_width = STYLE_MENU_ESTIMATED_WIDTH, height?: number) {
  const viewportHeight = window.innerHeight
  const safeMaxHeight = Math.max(220, viewportHeight - STYLE_MENU_SAFE_TOP - STYLE_MENU_SAFE_BOTTOM)
  const measuredHeight = height ?? safeMaxHeight
  const visibleHeight = Math.min(measuredHeight, safeMaxHeight)
  const top = Math.max(STYLE_MENU_SAFE_TOP, Math.round((viewportHeight - visibleHeight) / 2))

  styleMenuPosition.value = { left: STYLE_MENU_LEFT_OFFSET, top, maxHeight: safeMaxHeight }
}

async function syncStyleMenuLayout() {
  if (!styleMenuVisible.value) return

  await nextTick()
  window.requestAnimationFrame(() => {
    const panel = styleMenuPanelRef.value
    if (!panel) {
      computeStyleMenuPosition()
      return
    }
    computeStyleMenuPosition(panel.offsetWidth, panel.offsetHeight)
  })
}

async function openStyleMenu() {
  styleMenuVisible.value = true
  computeStyleMenuPosition()
  await syncStyleMenuLayout()
}

function closeStyleMenu() {
  styleMenuVisible.value = false
}

async function toggleStyleMenu() {
  if (styleMenuVisible.value) {
    closeStyleMenu()
    return
  }
  await openStyleMenu()
}

function handleStyleMenuEnter() {
  void syncStyleMenuLayout()
}

function handleStyleMenuAfterEnter() {
  void syncStyleMenuLayout()
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!styleMenuVisible.value) return
  const target = event.target as HTMLElement | null
  if (isStyleMenuRelatedTarget(target)) return
  closeStyleMenu()
}

function handleReaderDomToggleStyleMenu() {
  void toggleStyleMenu()
}

function handleReaderDomCloseStyleMenu() {
  closeStyleMenu()
}

function handleWindowResize() {
  if (!styleMenuVisible.value) return
  void syncStyleMenuLayout()
}

watch(styleMenuVisible, (visible) => {
  setStyleMenuButtonActive(visible)
})

// ============================================================
// 弹窗状态
// ============================================================
const assistantVisible = ref(false)
const helpVisible = ref(false)
const systemFontDialogVisible = ref(false)

function handleOpenSystemFontDialog() {
  closeStyleMenu()
  systemFontDialogVisible.value = true
}

// ============================================================
// 窗口事件注册 & 初始化
// ============================================================
const unlistenBook = ref<UnlistenFn | null>(null)
const unlistenClosed = ref<UnlistenFn | null>(null)
const unlistenStyle = ref<UnlistenFn | null>(null)
const unlistenTheme = ref<UnlistenFn | null>(null)
const unlistenWindowHide = ref<UnlistenFn | null>(null)
const unlistenShowBookInfo = ref<UnlistenFn | null>(null)
const unlistenShowAssistant = ref<UnlistenFn | null>(null)
const unlistenShowHelp = ref<UnlistenFn | null>(null)

const saveReaderSession = async () => {
  await saveReaderRendition().catch(() => {
    logError('reader', '窗口关闭异常: 阅读进度保存失败')
  })
  await saveReaderConfig().catch(() => {
    logError('reader', '窗口关闭异常: 全局配置保存失败')
  })
}

registerReaderWindowEvents({
  onLoadBookKey: async (event) => {
    const payload = event.payload || {}
    if (!payload.bookKey) {
      logWarn('ReaderApp', '收到无效的load-book消息', payload)
      return
    }

    if (payload.messageId) {
      await ackReaderLoadMessage(payload.messageId).catch((error) => {
        logWarn('ReaderApp', 'load-book ACK失败', error)
      })
    }

    await saveReaderRendition()
    pendingBookKey.value = payload.bookKey
    if (payload.cfi) {
      await loadBook(payload.cfi)
    } else {
      await loadBook()
    }
  },
  onShowBookInfo: () => { bookInfoVisible.value = true },
  onShowAssistant: () => { assistantVisible.value = true },
  onShowHelp: () => { helpVisible.value = true },
  onUpdateAppTheme: async (mode) => {
    appThemeMode.value = mode
    readerConfigStore.setReaderConfig(
      syncReaderConfigThemeColors(readerConfig.value, appThemeMode.value)
    )
    await applyReaderStyle()
  },
  onUpdateReaderStyle: async () => {
    readerConfigStore.setReaderConfig(
      syncReaderConfigThemeColors(readerConfig.value, appThemeMode.value)
    )
    await applyReaderStyle()
  },
  onWindowHide: async () => {
    await saveReaderSession()
    // 清空当前书籍 DOM 结构
    if (rendition.value) {
      stylesheetIsolationController?.destroy()
      stylesheetIsolationController = null
      try {
        destroyEpubRendition(rendition.value)
      } catch (e) {
        logWarn('ReaderApp', '隐藏时销毁 Rendition 失败', e)
      }
      rendition.value = null
    }
  },
  onCloseRequested: async () => {
    await saveReaderSession()
  },
}).then((unlisteners) => {
  unlistenBook.value = unlisteners.unlistenBook
  unlistenStyle.value = unlisteners.unlistenStyle
  unlistenTheme.value = unlisteners.unlistenTheme
  unlistenWindowHide.value = unlisteners.unlistenWindowHide
  unlistenClosed.value = unlisteners.unlistenClose
  unlistenShowBookInfo.value = unlisteners.unlistenShowBookInfo
  unlistenShowAssistant.value = unlisteners.unlistenShowAssistant
  unlistenShowHelp.value = unlisteners.unlistenShowHelp
})

void notifyReaderWindowReady().catch((error) => {
  logWarn('ReaderApp', '通知后端reader就绪失败', error)
})

// ============================================================
// 生命周期
// ============================================================
onMounted(async () => {
  await loadReaderConfig()

  document.addEventListener('keydown', keydownHandler)
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  window.addEventListener(READER_DOM_EVENTS.TOGGLE_STYLE_MENU, handleReaderDomToggleStyleMenu)
  window.addEventListener(READER_DOM_EVENTS.CLOSE_STYLE_MENU, handleReaderDomCloseStyleMenu)
  window.addEventListener('resize', handleWindowResize)
})

onUnmounted(() => {
  document.removeEventListener('keydown', keydownHandler)
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  window.removeEventListener(READER_DOM_EVENTS.TOGGLE_STYLE_MENU, handleReaderDomToggleStyleMenu)
  window.removeEventListener(READER_DOM_EVENTS.CLOSE_STYLE_MENU, handleReaderDomCloseStyleMenu)
  window.removeEventListener('resize', handleWindowResize)
  unlistenBook.value?.()
  unlistenStyle.value?.()
  unlistenTheme.value?.()
  unlistenWindowHide.value?.()
  unlistenClosed.value?.()
  unlistenShowBookInfo.value?.()
  unlistenShowAssistant.value?.()
  unlistenShowHelp.value?.()
  detachTocButtonListener?.()
  detachTocButtonListener = null
  stylesheetIsolationController?.destroy()
  stylesheetIsolationController = null
  setStyleMenuButtonActive(false)
})
</script>

<style scoped>
/* 全局样式 */
:global(.el-drawer__header) {
  margin-bottom: 0 !important;
}
:global(.el-menu.el-menu--vertical) {
  border: none;
}
:global(.el-drawer__body::-webkit-scrollbar) {
  width: 8px;
}
:global(.el-drawer__body::-webkit-scrollbar-track) {
  background: transparent;
}
:global(.el-drawer__body::-webkit-scrollbar-thumb) {
  background-color: var(--scrollbar-thumb);
  border-radius: 6px;
  background-clip: content-box;
}
:global(.bookmark-highlight) {
  fill-opacity: 0.4;
  pointer-events: all;
  cursor: var(--t-mouse-cursor-link), default;
  user-select: none;
}
:global(.bookmark-highlight rect) {
  rx: 5;
  ry: 5;
}

:global(.style-menu-panel) {
  position: fixed;
  z-index: 4700;
  transform-origin: left center;
  will-change: transform, opacity, filter;
  backface-visibility: hidden;
  max-height: calc(100vh - 120px);
  max-width: calc(100vw - 24px);
}

:global(.style-menu-enter-active),
:global(.style-menu-leave-active) {
  transition:
    opacity var(--duration-slow) var(--easing-standard),
    transform var(--duration-slow) var(--easing-standard),
    filter var(--duration-slow) var(--easing-standard);
}

:global(.style-menu-enter-from) {
  opacity: 0;
  transform: translate3d(-20px, 0, 0) scale(0.8);
  filter: blur(4px);
}

:global(.style-menu-leave-to) {
  opacity: 0;
  transform: translate3d(-16px, 0, 0) scale(0.86);
  filter: blur(4px);
}

.reader {
  width: 100%;
  height: 100%;
  color: var(--reader-text);
  background: var(--reader-background);

  #epub-reader {
    position: absolute;
    padding: 30px 0px 40px 0px;
    width: 100%;
    height: 100%;
    background: var(--reader-background);
  }

  /* 阅读容器滚动条样式 */
  #epub-reader :deep(.epub-container) {
    overflow-x: hidden !important;
  }
  #epub-reader :deep(iframe) {
    background: transparent !important;
  }
  #epub-reader :deep(.epub-container)::-webkit-scrollbar {
    width: 12px;
  }
  #epub-reader :deep(.epub-container)::-webkit-scrollbar-track {
    background: transparent;
  }
  #epub-reader :deep(.epub-container)::-webkit-scrollbar-thumb {
    background-color: var(--scrollbar-thumb);
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

    .button {
      height: 100px;
      background: var(--reader-surface);
      color: var(--reader-text-muted);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-sm);
      padding: 15px;
      opacity: 0;
      transition:
        opacity var(--duration-base) var(--easing-standard),
        transform var(--duration-fast) var(--easing-standard),
        background-color var(--duration-fast) var(--easing-standard),
        color var(--duration-fast) var(--easing-standard);
      pointer-events: auto;
      box-shadow: var(--shadow-sm);

      &:hover {
        opacity: 1;
        transform: translateY(-1px);
        background: var(--reader-surface-strong);
        color: var(--reader-text);
      }
    }

    .prev-page {
      position: absolute;
      left: 10px;
    }

    .next-page {
      position: absolute;
      right: 10px;
    }
  }
}

.drawer-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.reading-status {
  position: fixed;
  bottom: 15px;
  left: 50px;
  max-width: min(54vw, calc(100vw - 88px));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.45;
  color: var(--reader-text-muted);
  font-size: 13px;
  font-weight: bold;
  text-shadow: var(--text-shadow-soft);
}
</style>
