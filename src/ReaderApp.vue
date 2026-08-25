<template>
  <div class="reader">
    <!-- EPUB 阅读器内容 -->
    <div id="epub-reader"></div>
    <!-- 翻页按钮 -->
    <div class="pagination">
      <button class="prev-page button" @click="prevPage">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 20 20">
          <path fill="currentColor" d="m4 10l9 9l1.4-1.5L7 10l7.4-7.5L13 1z" />
        </svg>
      </button>
      <button class="next-page button" @click="nextPage">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 20 20">
          <path fill="currentColor" d="M7 1L5.6 2.5L13 10l-7.4 7.5L7 19l9-9z" />
        </svg>
      </button>
    </div>
  </div>
  <el-drawer v-model="tocDrawer" direction="ltr" :show-close="false" @open="handleTocOpen">
    <template #header>
      <span class="drawer-title">目录</span>
    </template>
    <el-menu ref="tocMenuRef" :default-active="activeChapter" @select="goToChapter">
      <template v-for="item in toc" :key="item.id || item.href">
        <toc-menu v-if="item.subitems?.length" :sub-toc="item" />
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
  <!-- 功能帮助 -->
  <HelpDialog v-model="helpVisible" @open-system-font-dialog="handleOpenSystemFontDialogFromHelp" />
  <SystemFontEnableDialog v-model="systemFontDialogVisible" />
  <!-- AI绘画 -->
  <DrawDialog
    v-model="drawDialogVisible"
    :book-key="currentBookKey"
    :initial-prompt="drawDialogPrompt"
    :rendition="rendition"
  />
  <!-- 智能问答 -->
  <ChatDialog v-model="chatDialogVisible" :book-key="currentBookKey" />
  <!-- AI绘画后台任务状态（右下角） -->
  <GenerationStatusBar />
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
import { ref, onMounted, onUnmounted, computed, nextTick, watch, type Ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useReaderConfig } from './services/reader/config'
import { logInfo, logWarn, logError } from '@/utils/logger'
import BookInfoDialog from './components/BookInfoDialog/index.vue'
import ContextMenu from './components/ContextMenu/index.vue'
import BookMarkDialog from './components/BookMark/bookMarkDialog.vue'
import HelpDialog from './components/HelpDialog/index.vue'
import DrawDialog from './components/DrawDialog/index.vue'
import ChatDialog from './components/ChatDialog/index.vue'
import GenerationStatusBar from './components/DrawDialog/GenerationStatusBar.vue'
import StyleMenu from './components/StyleMenu/index.vue'
import SystemFontEnableDialog from './components/SystemFontEnableDialog/index.vue'
import TocMenu from './components/TocMenu/index.vue'
import { BookConfig } from '@/services/book/types'
import { ContextMenuData, ContextMenuItem } from '@/components/ContextMenu/types'
import { READER_DOM_EVENTS } from '@/constants/events'
import { destroyEpubRendition, renderEpubBook } from '@/services/reader/epubRender'
import type { EpubBuiltInStylesheetIsolationController } from '@/services/reader/stylesheetIsolation'
import { loadReaderBookData } from '@/services/reader/load'
import { saveReaderProgress } from '@/services/reader/progress'
import { registerReaderWindowEvents } from '@/services/reader/windowEvents'
import {
  addBookmarkUnderline,
  initBookMarksForBook,
  removeBookmarkUnderline,
} from '@/services/reader/bookmark'
import { bindRenditionEvents } from '@/services/reader/renditionEvents'
import { collectParentChapterIndexes, scrollDrawerToActiveChapter } from '@/services/reader/toc'
import { buildContextMenuData } from '@/services/reader/contextMenu'
import { bindReaderInteractions } from '@/services/reader/interaction'
import { useBookmarkEditor } from '@/composables/useBookmarkEditor'
import { useBookMarkState, BookMark } from './services/reader/bookmarkState'
import { withReaderLoading } from '@/services/reader/loadingOverlay'
import { applyReaderStyles, ReaderStyleConfig } from '@/services/reader/style'
import { serializeReaderThemeCss } from '@/services/reader/epubStyle'
import { loadReaderConfigFromDisk, saveReaderConfigToDisk } from '@/services/reader/config'
import { fetchSystemFonts, normalizeReaderConfig } from '@/services/reader/systemFonts'
import { buildReaderFontApplication } from '@/services/reader/fontApplication'
import { primeBookLocationsAfterImport } from '@/services/book/cache'
import { getReadyBookLocations } from '@/services/book/locationsCache'
import { normalizeDisplayedChapterTitle } from '@/services/book/presentation'
import { loadBookMarksByBookKey } from '@/services/book/bookmarks'
import { loadPreferredUnderlineStyle } from '@/services/reader'
import { resolveEpubTocLabel } from '@/services/reader/epubProgress'
import {
  buildReaderBackgroundDeclarations,
  getAppliedAppThemeMode,
  getReaderRuntimePalette,
  syncReaderConfigThemeColors,
} from '@/services/theme'
import type { AppThemeMode } from '@/services/settings'
import type { EpubRenditionLike, EpubTocItem } from '@/services/reader/epubTypes'
import {
  ackReaderBookDelete,
  ackReaderLoadMessage,
  dispatchBookshelfProgressSaved,
  notifyReaderWindowReady,
} from '@/services/ipc'
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
let readerLoadGeneration = 0

// ============================================================
// 阅读配置 store
// ============================================================
const readerConfigStore = useReaderConfig()
const { readerConfig } = readerConfigStore

// ============================================================
// 主题
// ============================================================
const appThemeMode = ref<AppThemeMode>(getAppliedAppThemeMode())

const readerPalette = computed(() =>
  getReaderRuntimePalette(readerConfig.value, appThemeMode.value),
)
const readerFontApplication = computed(() =>
  buildReaderFontApplication(readerConfig.value.font, readerConfig.value.enabledSystemFonts),
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
      ...buildReaderBackgroundDeclarations(readerPalette.value),
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
      ...buildReaderBackgroundDeclarations(readerPalette.value),
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
  const themeCss = applyReaderStyles(
    readerConfig.value as ReaderStyleConfig,
    readerDefaultTheme.value,
    rendition.value,
    appThemeMode.value,
    applyIframeStyle,
  )

  if (themeCss !== undefined) {
    stylesheetIsolationController?.setCustomStylesheet(themeCss)
  }
}

// ============================================================
// 阅读配置持久化
// ============================================================
async function loadReaderConfig() {
  try {
    const [configTemp, systemFonts] = await Promise.all([
      loadReaderConfigFromDisk(),
      fetchSystemFonts().catch((error) => {
        logWarn('reader', 'load-system-fonts-failed skip-migration', error)
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
      syncReaderConfigThemeColors(readerConfig.value, appThemeMode.value),
    )
    logWarn('reader', 'load-reader-config-failed use-default')
  }
}

async function saveReaderConfig() {
  await saveReaderConfigToDisk(syncReaderConfigThemeColors(readerConfig.value, appThemeMode.value))
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
    currentBookConfig: currentBookConfig.value,
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
      logWarn('reader', 'notify-bookshelf-refresh-failed', error)
    })
  }
}

// ============================================================
// 页面导航
// ============================================================
let disposeReaderInteractions: (() => void) | null = null

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
  const currentWindow = getCurrentWindow()
  const isFullscreen = await currentWindow.isFullscreen()
  if (!isFullscreen) {
    // 进入全屏前让 epub.js 暂停响应 resize，避免 iframe 内容重排与全屏动画冲突
    window.dispatchEvent(new CustomEvent('reader:before-fullscreen'))
  }
  await invoke('window_toggle_fullscreen', { label: currentWindow.label })
  if (!isFullscreen) {
    // 全屏完成后再恢复 resize 监听并手动触发一次重排
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('reader:after-fullscreen'))
    })
  }
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

  const handler = () => {
    tocDrawer.value = true
  }
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
    margin: 20,
    theme: appThemeMode.value,
  })
  showContextMenu.value = true
}

// ============================================================
// 书签
// ============================================================
const bookMarkStore = useBookMarkState()
const { bookMarks } = bookMarkStore
const defaultUnderlineStyle = loadPreferredUnderlineStyle()

const { bookMarkEditionVisible, bookMarkEditionContent, openEditorByMarkId, closeEditor } =
  useBookmarkEditor({
    bookMarkStore,
    rendition,
    defaultUnderlineStyle,
  })

function initAllBookMarks() {
  if (!currentBookKey.value) return

  initBookMarksForBook(
    rendition.value,
    bookMarks.value,
    currentBookKey.value,
    defaultUnderlineStyle,
  )
}

async function addBookMark() {
  const tempId = generateID(3)
  const style = loadPreferredUnderlineStyle()
  const bookMark: BookMark = {
    id: tempId,
    bookName: currentBookKey.value ? currentBookKey.value : '',
    bookCfi: selectedRange.value ? selectedRange.value : '',
    bookTitle: (await rendition.value?.book?.loaded?.metadata)?.title || '未知书籍',
    content: selectedText.value,
    createTime: formatDate(new Date()),
    underlineColor: style.color,
    underlineType: style.type,
    underlineWidth: style.width,
  }
  bookMarkStore.addBookMark(bookMark)
  addBookmarkUnderline(
    rendition.value,
    selectedRange.value ? selectedRange.value : '',
    tempId,
    style,
  )
  return tempId
}

async function addBookMarkComment() {
  const bookMarkId = await addBookMark()
  openEditorByMarkId(bookMarkId)
}

function delBookMark(markId: string) {
  const bookMark = bookMarkStore.getBookMark(markId)[0]
  removeBookmarkUnderline(rendition.value, bookMark.bookCfi)
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
    onMarkClicked: (markId: string) => openEditorByMarkId(markId),
  })
}

function bindCurrentReaderInteractions() {
  disposeReaderInteractions?.()
  disposeReaderInteractions = null

  if (!rendition.value) return

  const binding = bindReaderInteractions(rendition.value, {
    onPrevPage: () => prevPage(),
    onNextPage: () => nextPage(),
    onToggleFullscreen: () => switchFullscreen(),
    hideContextMenu: () => {
      showContextMenu.value = false
    },
    isParentPointerIgnored: (target) => styleMenuVisible.value && isStyleMenuRelatedTarget(target),
    isOverlayOpen: () => anyReaderOverlayOpen.value,
    openContextMenu: (x, y, menuItems) =>
      openContextMenu('root', x, y, menuItems as ContextMenuItem[]),
    buildContextMenuItems: () => [
      { label: '标记 | 添加书签', type: 'bookmark', onClick: () => addBookMark() },
      { label: '注释 | 个人评论', type: 'comment', onClick: () => addBookMarkComment() },
      { label: '绘画 | 生成插画', type: 'draw', onClick: () => openDrawDialogWithSelection() },
    ],
    buildBookmarkContextMenuItems: (markId: string) => [
      { label: '编辑 | 编辑笔记', type: 'edit', onClick: () => openEditorByMarkId(markId) },
      { label: '删除 | 删除笔记', type: 'delBookMark', onClick: () => delBookMark(markId) },
    ],
  })

  disposeReaderInteractions = binding.dispose
}

interface DisposeReaderBookRuntimeOptions {
  invalidateLoad?: boolean
  resetBookState?: boolean
}

function disposeReaderBookRuntime(options: DisposeReaderBookRuntimeOptions = {}) {
  const { invalidateLoad = true, resetBookState = true } = options
  if (invalidateLoad) {
    readerLoadGeneration += 1
  }

  try {
    disposeReaderInteractions?.()
  } catch (error) {
    logWarn('reader', 'dispose-reader-interactions-failed', error)
  }
  disposeReaderInteractions = null

  try {
    stylesheetIsolationController?.destroy()
  } catch (error) {
    logWarn('reader', 'destroy-stylesheet-isolation-failed', error)
  }
  stylesheetIsolationController = null

  if (rendition.value) {
    try {
      destroyEpubRendition(rendition.value)
    } catch (error) {
      logWarn('reader', 'destroy-rendition-failed', error)
    }
    rendition.value = null
  }

  document.getElementById('epub-reader')?.replaceChildren()
  detachTocButtonListener?.()
  detachTocButtonListener = null
  toc.value = []
  activeChapter.value = ''
  tocDrawer.value = false
  readingPercentage.value = ''
  readingChapterTitle.value = ''
  selectedText.value = ''
  selectedRange.value = null
  showContextMenu.value = false
  bookInfoVisible.value = false
  drawDialogVisible.value = false
  chatDialogVisible.value = false
  drawDialogPrompt.value = ''
  bookMarkStore.clearBookMarks()

  if (resetBookState) {
    currentBookKey.value = null
    pendingBookKey.value = null
    currentBookConfig.value = null
  }
}

async function loadBook(bookKey: string, cfi?: string) {
  const generation = ++readerLoadGeneration
  let replacedReaderRuntime = false
  pendingBookKey.value = bookKey

  await withReaderLoading(async () => {
    const loadedBook = await loadReaderBookData(bookKey)
    if (generation !== readerLoadGeneration) return

    const { bookConfig, bookLocationsCache, fileName, bookArrayBuffer } = loadedBook
    disposeReaderBookRuntime({ invalidateLoad: false, resetBookState: true })
    replacedReaderRuntime = true
    pendingBookKey.value = bookKey

    const epubBook = await renderEpubBook(
      bookArrayBuffer as ArrayBuffer,
      readerConfig.value.flow,
      readerConfig.value.epubBuiltInStylesheetMode,
      cfi,
      bookConfig,
      getReadyBookLocations(bookLocationsCache),
      serializeReaderThemeCss(readerDefaultTheme.value),
    )

    if (generation !== readerLoadGeneration) {
      epubBook.stylesheetIsolation.destroy()
      destroyEpubRendition(epubBook.rendition)
      document.getElementById('epub-reader')?.replaceChildren()
      return
    }

    rendition.value = epubBook.rendition
    stylesheetIsolationController = epubBook.stylesheetIsolation
    currentBookKey.value = bookKey
    pendingBookKey.value = null
    currentBookConfig.value = bookConfig
    readingChapterTitle.value = normalizeDisplayedChapterTitle(bookConfig.durChapterTitle)

    await applyReaderStyle(false)
    await rendition.value.display(epubBook.displayTarget)
    if (generation !== readerLoadGeneration) return

    handleRenditionEvents()
    bindCurrentReaderInteractions()
    toc.value = epubBook.toc
    bindTocButtonClick()

    if (bookLocationsCache?.status !== 'ready') {
      queueMicrotask(() => {
        void primeBookLocationsAfterImport(bookKey, bookArrayBuffer as ArrayBuffer, fileName).catch(
          (error) => {
            logWarn('reader', 'prime-locations-cache-failed', error)
          },
        )
      })
    }

    const currentBookMarks = await loadBookMarksByBookKey(bookKey)
    if (generation !== readerLoadGeneration) return

    if (currentBookMarks.length > 0) {
      bookMarkStore.importBookMark(currentBookMarks)
      void initAllBookMarks()
    }

    logInfo('reader', 'load-book', {
      bookKey,
      title: bookConfig.name,
    })
  }).catch((error) => {
    if (generation === readerLoadGeneration) {
      if (replacedReaderRuntime) {
        disposeReaderBookRuntime({ invalidateLoad: false })
      } else {
        pendingBookKey.value = null
      }
    }
    logError('reader', 'load-book-failed', error, { bookKey })
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

function handleReaderDomToggleStyleMenu() {
  void toggleStyleMenu()
}

function handleReaderDomCloseStyleMenu() {
  closeStyleMenu()
}

let resizeSuspended = false

function handleWindowResize() {
  if (resizeSuspended) return
  if (!styleMenuVisible.value) return
  void syncStyleMenuLayout()
}

function handleBeforeFullscreen() {
  resizeSuspended = true
}

function handleAfterFullscreen() {
  resizeSuspended = false
  // 手动触发一次 epub.js 重排，确保 iframe 内容在全屏后正确渲染
  if (rendition.value && typeof rendition.value.resize === 'function') {
    rendition.value.resize()
  }
}

watch(styleMenuVisible, (visible) => {
  setStyleMenuButtonActive(visible)
})

// ============================================================
// 弹窗状态
// ============================================================
const helpVisible = ref(false)
const systemFontDialogVisible = ref(false)
const drawDialogVisible = ref(false)
const drawDialogPrompt = ref('')
const chatDialogVisible = ref(false)

function openDrawDialogWithSelection() {
  drawDialogPrompt.value = selectedText.value
  drawDialogVisible.value = true
}

function handleReaderDomToggleDrawDialog() {
  if (drawDialogVisible.value) {
    drawDialogVisible.value = false
    return
  }
  drawDialogPrompt.value = ''
  drawDialogVisible.value = true
}

function handleReaderDomToggleChatDialog() {
  chatDialogVisible.value = !chatDialogVisible.value
}

function handleOpenSystemFontDialog() {
  closeStyleMenu()
  systemFontDialogVisible.value = true
}

function handleOpenSystemFontDialogFromHelp() {
  helpVisible.value = false
  systemFontDialogVisible.value = true
}

// ============================================================
// 弹窗打开状态聚合（用于临时禁用阅读器快捷键）
// ============================================================
const anyReaderOverlayOpen = computed(
  () =>
    bookInfoVisible.value ||
    tocDrawer.value ||
    showContextMenu.value ||
    bookMarkEditionVisible.value ||
    helpVisible.value ||
    systemFontDialogVisible.value ||
    drawDialogVisible.value ||
    chatDialogVisible.value ||
    styleMenuVisible.value,
)

// ============================================================
// 弹窗互斥：该窗口至多同时只有一个弹窗显示，
// 打开下一个弹窗时自动关闭上一个，方向键锁定状态随之同步
// ============================================================
const readerOverlayRefs: Array<Ref<boolean>> = [
  bookInfoVisible,
  tocDrawer,
  showContextMenu,
  bookMarkEditionVisible,
  helpVisible,
  systemFontDialogVisible,
  drawDialogVisible,
  chatDialogVisible,
  styleMenuVisible,
]

for (const overlayRef of readerOverlayRefs) {
  watch(overlayRef, (visible) => {
    if (!visible) return
    for (const otherRef of readerOverlayRefs) {
      if (otherRef !== overlayRef) {
        otherRef.value = false
      }
    }
  })
}

// ============================================================
// 窗口事件注册 & 初始化
// ============================================================
const unlistenBook = ref<UnlistenFn | null>(null)
const unlistenPrepareBookDelete = ref<UnlistenFn | null>(null)
const unlistenClosed = ref<UnlistenFn | null>(null)
const unlistenStyle = ref<UnlistenFn | null>(null)
const unlistenTheme = ref<UnlistenFn | null>(null)
const unlistenWindowHide = ref<UnlistenFn | null>(null)
const unlistenShowBookInfo = ref<UnlistenFn | null>(null)
const unlistenShowHelp = ref<UnlistenFn | null>(null)

const saveReaderSession = async () => {
  await saveReaderRendition().catch(() => {
    logError('reader', 'close-save-progress-failed')
  })
  await saveReaderConfig().catch(() => {
    logError('reader', 'close-save-config-failed')
  })
}

let readerLifecycleQueue: Promise<void> = Promise.resolve()

const runReaderLifecycleTask = (task: () => Promise<void>): Promise<void> => {
  const nextTask = readerLifecycleQueue.then(task, task)
  readerLifecycleQueue = nextTask.catch(() => undefined)
  return nextTask
}

registerReaderWindowEvents({
  onLoadBookKey: async (event) => {
    const payload = event.payload || {}
    if (!payload.bookKey) {
      logWarn('reader', 'invalid-load-book-message', payload)
      return
    }

    if (payload.messageId) {
      await ackReaderLoadMessage(payload.messageId).catch((error) => {
        logWarn('reader', 'load-book-ack-failed', error)
      })
    }

    await runReaderLifecycleTask(async () => {
      await saveReaderRendition().catch((error) => {
        logWarn('reader', 'save-previous-progress-failed continue-load', error)
      })
      await loadBook(payload.bookKey, payload.cfi)
    })
  },
  onPrepareBookDelete: (event) =>
    runReaderLifecycleTask(async () => {
      const payload = event.payload
      if (!payload?.bookKey || !payload.messageId) {
        logWarn('reader', 'invalid-prepare-book-delete-message', payload)
        return
      }

      const affected =
        currentBookKey.value === payload.bookKey || pendingBookKey.value === payload.bookKey
      if (affected) {
        disposeReaderBookRuntime()
        logInfo('reader', 'prepare-book-delete-cleanup', {
          bookKey: payload.bookKey,
          messageId: payload.messageId,
        })
      }

      await ackReaderBookDelete(payload.messageId, affected).catch((error) => {
        logError('reader', 'prepare-book-delete-ack-failed', error, {
          bookKey: payload.bookKey,
          messageId: payload.messageId,
        })
      })
    }),
  onShowBookInfo: () => {
    bookInfoVisible.value = true
  },
  onShowHelp: () => {
    helpVisible.value = true
  },
  onUpdateAppTheme: async (mode) => {
    appThemeMode.value = mode
    readerConfigStore.setReaderConfig(
      syncReaderConfigThemeColors(readerConfig.value, appThemeMode.value),
    )
    await applyReaderStyle()
  },
  onUpdateReaderStyle: async () => {
    readerConfigStore.setReaderConfig(
      syncReaderConfigThemeColors(readerConfig.value, appThemeMode.value),
    )
    await applyReaderStyle()
  },
  onWindowHide: () =>
    runReaderLifecycleTask(async () => {
      try {
        await saveReaderSession()
      } finally {
        disposeReaderBookRuntime()
      }
    }),
  onCloseRequested: () =>
    runReaderLifecycleTask(async () => {
      await saveReaderSession()
    }),
}).then((unlisteners) => {
  unlistenBook.value = unlisteners.unlistenBook
  unlistenPrepareBookDelete.value = unlisteners.unlistenPrepareBookDelete
  unlistenStyle.value = unlisteners.unlistenStyle
  unlistenTheme.value = unlisteners.unlistenTheme
  unlistenWindowHide.value = unlisteners.unlistenWindowHide
  unlistenClosed.value = unlisteners.unlistenClose
  unlistenShowBookInfo.value = unlisteners.unlistenShowBookInfo
  unlistenShowHelp.value = unlisteners.unlistenShowHelp
})

void notifyReaderWindowReady().catch((error) => {
  logWarn('reader', 'notify-reader-ready-failed', error)
})

// ============================================================
// 生命周期
// ============================================================
onMounted(async () => {
  await loadReaderConfig()

  window.addEventListener(READER_DOM_EVENTS.TOGGLE_STYLE_MENU, handleReaderDomToggleStyleMenu)
  window.addEventListener(READER_DOM_EVENTS.CLOSE_STYLE_MENU, handleReaderDomCloseStyleMenu)
  window.addEventListener(READER_DOM_EVENTS.TOGGLE_DRAW_DIALOG, handleReaderDomToggleDrawDialog)
  window.addEventListener(READER_DOM_EVENTS.TOGGLE_CHAT_DIALOG, handleReaderDomToggleChatDialog)
  window.addEventListener('resize', handleWindowResize)
  window.addEventListener('reader:before-fullscreen', handleBeforeFullscreen)
  window.addEventListener('reader:after-fullscreen', handleAfterFullscreen)
})

onUnmounted(() => {
  disposeReaderBookRuntime()
  window.removeEventListener(READER_DOM_EVENTS.TOGGLE_STYLE_MENU, handleReaderDomToggleStyleMenu)
  window.removeEventListener(READER_DOM_EVENTS.CLOSE_STYLE_MENU, handleReaderDomCloseStyleMenu)
  window.removeEventListener(READER_DOM_EVENTS.TOGGLE_DRAW_DIALOG, handleReaderDomToggleDrawDialog)
  window.removeEventListener(READER_DOM_EVENTS.TOGGLE_CHAT_DIALOG, handleReaderDomToggleChatDialog)
  window.removeEventListener('resize', handleWindowResize)
  window.removeEventListener('reader:before-fullscreen', handleBeforeFullscreen)
  window.removeEventListener('reader:after-fullscreen', handleAfterFullscreen)
  unlistenBook.value?.()
  unlistenPrepareBookDelete.value?.()
  unlistenStyle.value?.()
  unlistenTheme.value?.()
  unlistenWindowHide.value?.()
  unlistenClosed.value?.()
  unlistenShowBookInfo.value?.()
  unlistenShowHelp.value?.()
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
:global(.bookmark-underline) {
  pointer-events: all;
  cursor: var(--t-mouse-cursor-link), default;
  user-select: none;
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
  background-color: var(--reader-background);
  background-image: var(--reader-background-image, none);
  background-size: var(--reader-background-size, auto);
  background-position: var(--reader-background-position, 0 0);

  #epub-reader {
    position: absolute;
    padding: 30px 0px 40px 0px;
    width: 100%;
    height: 100%;
    background-color: var(--reader-background);
    background-image: var(--reader-background-image, none);
    background-size: var(--reader-background-size, auto);
    background-position: var(--reader-background-position, 0 0);
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
