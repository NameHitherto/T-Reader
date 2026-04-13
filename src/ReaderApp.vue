<template>
  <div class="reader">
    <!-- EPUB 阅读器内容 -->
    <div v-show="currentBookFormat === 'epub'" id="epub-reader"></div>
    <div v-show="currentBookFormat === 'txt'" id="txt-reader" @scroll="onTxtScroll">
      <div id="txt-reader-content">
        <p
          v-for="(paragraph, index) in txtParagraphs"
          :key="index"
          class="txt-paragraph"
          :data-idx="index"
        >
          {{ paragraph }}
        </p>
      </div>
    </div>
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
      <template v-for="item in toc">
        <toc-menu
          v-if="item.subitems.length > 0"
          :subToc="item"
        />
        <el-menu-item v-else :key="item.id" :index="item.href">
          {{ item.label }}
        </el-menu-item>
      </template>
    </el-menu>
  </el-drawer>
  <!-- 书籍详情信息 -->
  <book-info-dialog v-model="bookInfoVisible" :bookKey="currentBookKey" />
  <!-- 右键菜单 -->
  <ContextMenu v-model:show="showContextMenu" :menu-data="contextMenuOptions" />
  <!-- 笔记编辑框 -->
  <BookMarkDialog
    v-model="bookMarkEditionVisible"
    v-model:book-mark-list="bookMarkEditionContent"
    @delete="(markId: string) => delBookMark(markId)"
  />
  <!-- AI 助手 -->
  <AssistantDialog v-model="assistantVisible" :bookKey="currentBookKey" />
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

<script lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { UnlistenFn } from '@tauri-apps/api/event'
import { Rendition } from 'libs/epub.js'
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
import { BookConfig, BookFormat } from '@/types/book'
import { ContextMenuData, ContextMenuItem } from '@/types/contextMenu'
import { READER_DOM_EVENTS } from '@/constants/events'
import {
  calcTxtProgress,
  findParagraphIndexByScroll,
} from '@/services/reader/txt/txtReaderService'
import {
  destroyEpubRendition,
  renderEpubBook,
} from '@/services/reader/epub/epubAdapter'
import { renderTxtBook } from '@/services/reader/txt/txtAdapter'
import { resolveReaderDisplayTarget } from '@/services/reader/progressSnapshotService'
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
import { scrollTxtByPage } from '@/services/reader/txt/navigationService'
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
import {
  ackReaderLoadMessage,
  dispatchBookshelfProgressSaved,
  notifyReaderWindowReady,
} from '@/services/reader/readerWindowBridgeService'
import { formatDate } from '@/utils/date'
import { generateID } from '@/utils/id'

export default {
  name: 'ReaderApp',
  components: {
    BookInfoDialog,
    ContextMenu,
    BookMarkDialog,
    AssistantDialog,
    TocMenu,
    HelpDialog,
    StyleMenu,
    SystemFontEnableDialog,
  },
  setup() {
    const STYLE_MENU_ESTIMATED_WIDTH = 324
    const STYLE_MENU_LEFT_OFFSET = 12
    const STYLE_MENU_SAFE_TOP = 56
    const STYLE_MENU_SAFE_BOTTOM = 64

    // 当前正在阅读的书籍内部 key
    const currentBookKey = ref<string | null>(null)
    // 待加载书籍的内部 key
    const pendingBookKey = ref<string | null>(null)
    // 书籍信息弹窗
    const bookInfoVisible = ref(false)
    // EPUB 渲染对象
    const rendition = ref<Rendition | null>(null)
    // 当前书籍格式
    const currentBookFormat = ref<BookFormat>('epub')
    // 当前书籍配置
    const currentBookConfig = ref<BookConfig | null>(null)
    // TXT 段落内容
    const txtParagraphs = ref<string[]>([])
    // TXT 阅读位置（段落索引）
    const txtCurrentParagraph = ref(0)
    // 事件解绑函数
    const unlistenBook = ref<UnlistenFn | null>(null)
    const unlistenClosed = ref<UnlistenFn | null>(null)
    const unlistenStyle = ref<UnlistenFn | null>(null)
    const unlistenTheme = ref<UnlistenFn | null>(null)
    // 其他窗口事件监听
    const unlistenShowBookInfo = ref<UnlistenFn | null>(null)
    const unlistenShowAssistant = ref<UnlistenFn | null>(null)
    const unlistenShowHelp = ref<UnlistenFn | null>(null)
    // 目录按钮解绑函数，避免重复绑定
    let detachTocButtonListener: (() => void) | null = null
    // 阅读配置 store
    const readerConfigStore = useReaderConfigStore()
    // 响应式配置引用
    const { readerConfig } = storeToRefs(readerConfigStore)
    // 目录抽屉是否显示
    const tocDrawer = ref(false)
    // 目录菜单引用
    const tocMenuRef = ref<any>(null)
    // 目录数据
    const toc = ref<any[]>([])
    // 当前章节
    const activeChapter = ref<string>('')
    // 右键菜单显示状态
    const showContextMenu = ref(false)
    // 右键菜单配置
    const contextMenuOptions = ref({} as ContextMenuData)
    // 当前选中文本
    const selectedText = ref<string>('')
    // 当前选中范围
    const selectedRange = ref<string | null>(null)
    // 阅读进度百分比
    const readingPercentage = ref('')
    const readingChapterTitle = ref('')
    // 当前书籍书签 store
    const bookMarkStore = useBookMarkStore()
    // 响应式书签引用
    const { bookMarks } = storeToRefs(bookMarkStore)
    // 默认高亮颜色
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
    // AI 助手弹窗状态
    const assistantVisible = ref(false)
    // 帮助弹窗状态
    const helpVisible = ref(false)
    // 系统字体弹窗状态
    const systemFontDialogVisible = ref(false)
    // 样式菜单状态
    const styleMenuVisible = ref(false)
    const styleMenuPosition = ref({
      left: STYLE_MENU_LEFT_OFFSET,
      top: STYLE_MENU_SAFE_TOP,
      maxHeight: 320,
    })
    const styleMenuPanelRef = ref<HTMLElement | null>(null)
    const appThemeMode = ref<AppThemeMode>(getAppliedAppThemeMode())
    const readingStatusText = computed(() => {
      if (!readingPercentage.value) {
        return ''
      }

      return `${normalizeDisplayedChapterTitle(readingChapterTitle.value)} · ${readingPercentage.value}%`
    })
    const readerPalette = computed(() => {
      return getReaderRuntimePalette(readerConfig.value, appThemeMode.value)
    })
    const readerFontApplication = computed(() =>
      buildReaderFontApplication(
        readerConfig.value.font,
        readerConfig.value.enabledSystemFonts
      )
    )

    // 阅读器动态样式
    const readerDefaultTheme = computed(() => {
      const columnStyle = {}
      if (readerConfig.value.flow === 'paginated') {
        Object.assign(columnStyle, {
          'column-width': 'auto !important',
          'column-gap': `${2 * readerConfig.value.boxPaddingHorizontal}px !important`,
          'column-count': `${readerConfig.value.columnCount}`,
        })
      }
      const themeReturned: Record<string, any> = {
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

    // 应用阅读器样式
    const applyReaderStyle = async () => {
      applyReaderStyles(
        readerConfig.value as ReaderStyleConfig,
        readerDefaultTheme.value,
        rendition.value,
        appThemeMode.value
      )
    }

    const getStyleMenuButton = () => {
      return document.getElementById('titlebar-customer') as HTMLElement | null
    }

    const setStyleMenuButtonActive = (active: boolean) => {
      getStyleMenuButton()?.classList.toggle('active', active)
    }

    const isStyleMenuRelatedTarget = (target: HTMLElement | null) => {
      if (!target) {
        return false
      }

      if (
        target.closest('#customer-menu') ||
        target.closest('#titlebar-customer') ||
        target.closest('.system-font-enable-dialog-wrapper') ||
        target.closest('.system-font-enable-dialog-overlay') ||
        target.closest('.el-popper')
      ) {
        return true
      }

      return false
    }

    const computeStyleMenuPosition = (
      _width = STYLE_MENU_ESTIMATED_WIDTH,
      height?: number
    ) => {
      const viewportHeight = window.innerHeight
      const safeMaxHeight = Math.max(
        220,
        viewportHeight - STYLE_MENU_SAFE_TOP - STYLE_MENU_SAFE_BOTTOM
      )
      const measuredHeight = height ?? safeMaxHeight
      const visibleHeight = Math.min(measuredHeight, safeMaxHeight)

      const top = Math.max(
        STYLE_MENU_SAFE_TOP,
        Math.round((viewportHeight - visibleHeight) / 2)
      )

      styleMenuPosition.value = {
        left: STYLE_MENU_LEFT_OFFSET,
        top,
        maxHeight: safeMaxHeight,
      }
    }

    const syncStyleMenuLayout = async () => {
      if (!styleMenuVisible.value) {
        return
      }

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

    const openStyleMenu = async () => {
      styleMenuVisible.value = true
      computeStyleMenuPosition()
      await syncStyleMenuLayout()
    }

    const closeStyleMenu = () => {
      styleMenuVisible.value = false
    }

    const toggleStyleMenu = async () => {
      if (styleMenuVisible.value) {
        closeStyleMenu()
        return
      }

      await openStyleMenu()
    }

    const handleStyleMenuEnter = () => {
      void syncStyleMenuLayout()
    }

    const handleStyleMenuAfterEnter = () => {
      void syncStyleMenuLayout()
    }

    const onTxtScroll = () => {
      if (currentBookFormat.value !== 'txt') {
        return
      }
      const txtReader = document.getElementById('txt-reader')
      if (!txtReader) {
        return
      }

      const paragraphs = Array.from(
        txtReader.querySelectorAll('.txt-paragraph')
      ) as HTMLElement[]

      txtCurrentParagraph.value = findParagraphIndexByScroll(paragraphs, txtReader.scrollTop)

      readingPercentage.value = calcTxtProgress(
        txtReader.scrollTop,
        txtReader.scrollHeight,
        txtReader.clientHeight
      ).toFixed(1)
    }

    // 读取阅读配置
    const loadReaderConfig = async () => {
      try {
        const [configTemp, systemFonts] = await Promise.all([
          loadReaderConfigFromDisk(),
          fetchSystemFonts().catch((error) => {
            logWarn('reader', '加载系统字体失败，将跳过阅读器字体迁移', error)
            return []
          }),
        ])

        const normalizedConfig = normalizeReaderConfig(configTemp, systemFonts)
        const themedConfig = syncReaderConfigThemeColors(
          normalizedConfig,
          appThemeMode.value
        )
        readerConfigStore.setReaderConfig(themedConfig)

        if (JSON.stringify(configTemp) !== JSON.stringify(themedConfig)) {
          await saveReaderConfigToDisk(themedConfig)
        }
      } catch (e) {
        // 首次打开阅读器或配置文件不存在时回退默认配置
        readerConfigStore.setDefaultConfig()
        readerConfigStore.setReaderConfig(
          syncReaderConfigThemeColors(readerConfig.value, appThemeMode.value)
        )
        logWarn('reader', 'ReaderConfig.json文件不存在，已加载默认配置')
      }
    }

    // 保存阅读配置
    const saveReaderConfig = async () => {
      await saveReaderConfigToDisk(
        syncReaderConfigThemeColors(readerConfig.value, appThemeMode.value)
      )
    }

    const restoreTxtLocation = async (paragraphIndex = 0) => {
      await nextTick()
      const txtReader = document.getElementById('txt-reader')
      if (!txtReader) {
        return
      }
      txtCurrentParagraph.value = paragraphIndex
      const paragraphElement = txtReader.querySelector(
        `[data-idx="${paragraphIndex}"]`
      ) as HTMLElement | null
      if (paragraphElement) {
        txtReader.scrollTop = paragraphElement.offsetTop
      } else {
        txtReader.scrollTop = 0
      }
    }

    // 保存阅读进度
    const saveReaderRendition = async () => {
      if (!currentBookKey.value) {
        return
      }

      const savedProgress = await saveReaderProgress({
        bookKey: currentBookKey.value,
        format: currentBookFormat.value,
        rendition: rendition.value,
        txtCurrentParagraph: txtCurrentParagraph.value,
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

    // 初始化当前书籍书签
    const initAllBookMarks = async () => {
      if (!currentBookKey.value) {
        return
      }

      initBookMarksForBook(
        rendition.value,
        bookMarks.value,
        currentBookKey.value,
        defaultHighlightColor
      )
    }

    // 添加书签
    const addBookMark = async () => {
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

    // 添加书签并打开笔记编辑
    const addBookMarkComment = async () => {
      const bookMarkId = await addBookMark()
      openEditorByMarkId(bookMarkId)
    }

    // 删除书签
    const delBookMark = async (markId: string) => {
      const bookMark = bookMarkStore.getBookMark(markId)[0]
      removeBookmarkHighlight(rendition.value, bookMark.bookCfi)
      bookMarkStore.removeBookMark(markId)
      closeEditor()
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
      onShowBookInfo: () => {
        bookInfoVisible.value = true
      },
      onShowAssistant: () => {
        assistantVisible.value = true
      },
      onShowHelp: () => {
        helpVisible.value = true
      },
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
      onCloseRequested: async () => {
        await saveReaderRendition().catch(() => {
          logError('reader', '窗口关闭异常: 阅读进度保存失败')
        })
        await saveReaderConfig().catch(() => {
          logError('reader', '窗口关闭异常: 全局配置保存失败')
        })
      },
    }).then((unlisteners) => {
      unlistenBook.value = unlisteners.unlistenBook
      unlistenStyle.value = unlisteners.unlistenStyle
      unlistenTheme.value = unlisteners.unlistenTheme
      unlistenClosed.value = unlisteners.unlistenClose
      unlistenShowBookInfo.value = unlisteners.unlistenShowBookInfo
      unlistenShowAssistant.value = unlisteners.unlistenShowAssistant
      unlistenShowHelp.value = unlisteners.unlistenShowHelp
    })

    void notifyReaderWindowReady().catch((error) => {
      logWarn('ReaderApp', '通知后端reader就绪失败', error)
    })

    // 绑定 Rendition 事件
    const handleRenditionEvents = () => {
      if (rendition.value) {
        bindRenditionEvents(rendition.value, {
          onRelocated: (location) => {
            if (location.start) {
              activeChapter.value = location.start.href
              readingChapterTitle.value =
                resolveEpubTocLabel(rendition.value?.book?.navigation?.toc, location.start.href) ||
                normalizeDisplayedChapterTitle(currentBookConfig.value?.durChapterTitle)
            }
            const percentage = location.start.percentage
            if (percentage !== undefined && percentage !== null) {
              readingPercentage.value = (percentage * 100).toFixed(1)
            }
          },
          onSelected: (cfiRange, text) => {
            selectedText.value = text
            selectedRange.value = cfiRange
          },
          onKeyNavigatePrev: () => {
            prevPage()
          },
          onKeyNavigateNext: () => {
            nextPage()
          },
          onToggleFullscreen: () => {
            switchFullscreen()
          },
          onReaderClick: () => {
            resetReaderTransientUi({
              hideContextMenu: () => {
                showContextMenu.value = false
              },
            })
          },
          onMarkClicked: (markId: string) => {
            openEditorByMarkId(markId)
          },
          openContextMenu: (x, y, menuItems) => {
            openContextMenu('root', x, y, menuItems as ContextMenuItem[])
          },
          buildContextMenuItems: () => {
            return [
              {
                label: '标记 | 添加书签',
                type: 'bookmark',
                onClick: () => addBookMark(),
              },
              {
                label: '注释 | 个人评论',
                type: 'comment',
                onClick: () => addBookMarkComment(),
              },
            ]
          },
        })
      }
    }

    // 加载书籍
    const loadBook = async (cfi?: string) => {
      if (!pendingBookKey.value) {
        setTimeout(loadBook, 500) // 500ms 后重试加载书籍
        return
      }
      // 将待加载 key 设为当前阅读书籍
      currentBookKey.value = pendingBookKey.value
      // 书籍开始加载后清空待处理 key，避免重复触发
      pendingBookKey.value = null

      await withReaderLoading(async () => {
        const loadedBook = await loadReaderBookData(currentBookKey.value as string)
        const { bookConfig, bookCache, format, fileName, bookData, bookArrayBuffer } = loadedBook

        currentBookConfig.value = bookConfig
        currentBookFormat.value = format
        readingPercentage.value = ''
        readingChapterTitle.value = normalizeDisplayedChapterTitle(bookConfig.durChapterTitle)
        bookMarkStore.clearBookMarks()
        txtParagraphs.value = []
        txtCurrentParagraph.value = 0

        if (rendition.value) {
          try {
            destroyEpubRendition(rendition.value)
          } catch (e) {
            logWarn('ReaderApp', '销毁旧的 Rendition 失败', e)
          }
          rendition.value = null
        }

        if (currentBookFormat.value === 'txt') {
          toc.value = []
          activeChapter.value = ''
          readingChapterTitle.value = normalizeDisplayedChapterTitle(bookConfig.durChapterTitle)
          const displayTarget = await resolveReaderDisplayTarget('txt', bookData, bookConfig)
          const paragraphIndex =
            typeof displayTarget === 'number' ? displayTarget : 0

          const txtBook = renderTxtBook(bookData, paragraphIndex)
          txtParagraphs.value = txtBook.paragraphs

          await applyReaderStyle()
          await restoreTxtLocation(txtBook.paragraphIndex)
          const txtReader = document.getElementById('txt-reader')
          if (txtReader) {
            readingPercentage.value = calcTxtProgress(
              txtReader.scrollTop,
              txtReader.scrollHeight,
              txtReader.clientHeight
            ).toFixed(1)
          }
          return
        }

        const epubBook = await renderEpubBook(
          bookArrayBuffer as ArrayBuffer,
          readerConfig.value.flow,
          cfi,
          bookConfig,
          bookCache?.locations
        )
        rendition.value = epubBook.rendition
        handleRenditionEvents()
        toc.value = epubBook.toc
        await applyReaderStyle()
        bindTocButtonClick()

        if (!bookCache?.locations) {
          queueMicrotask(() => {
            void primeBookCacheAfterImport(
              currentBookKey.value as string,
              bookArrayBuffer as ArrayBuffer,
              format,
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

    // 目录抽屉打开回调
    const handleTocOpen = () => {
      const book = rendition.value?.book
      const indexGroup = collectParentChapterIndexes(book, activeChapter.value)

      // 打开当前章节的所有上级目录
      if (tocMenuRef.value && typeof tocMenuRef.value.open === 'function') {
        for (const index of indexGroup) {
          tocMenuRef.value.open(index)
        }
      }
      // 滚动到当前章节
      scrollDrawerToActiveChapter(500)
    }

    // 切换全屏（隐藏任务栏）
    const switchFullscreen = async () => {
      const win = getCurrentWindow()
      const isFullscreen = await win.isFullscreen()
      const isMaximized = await win.isMaximized()
      if (isFullscreen) {
        await win.setFullscreen(false)
      } else {
        if (isMaximized) {
          await win.unmaximize()
        }
        await win.setFullscreen(true)
      }
    }

    // 上一页
    const prevPage = () => {
      if (rendition.value && readerConfig.value.flow === 'paginated') {
        rendition.value.prev()
        return
      }

      if (currentBookFormat.value === 'txt') {
        scrollTxtByPage(document.getElementById('txt-reader'), 'prev', 0.85)
      }
    }

    // 下一页
    const nextPage = () => {
      if (rendition.value && readerConfig.value.flow === 'paginated') {
        rendition.value.next()
        return
      }

      if (currentBookFormat.value === 'txt') {
        scrollTxtByPage(document.getElementById('txt-reader'), 'next', 0.85)
      }
    }

    // 跳转到指定章节
    const goToChapter = (href: string) => {
      if (rendition.value) {
        rendition.value.display(href)
        tocDrawer.value = false
        activeChapter.value = href
        return
      }

      // TXT 当前暂不支持目录跳转
      tocDrawer.value = false
    }

    // 键盘事件处理
    const keydownHandler = (e: KeyboardEvent) => {
      dispatchReaderKeydown(e, {
        onPrevPage: () => prevPage(),
        onNextPage: () => nextPage(),
        onToggleFullscreen: () => switchFullscreen(),
      })
    }

    // 打开自定义右键菜单
    const openContextMenu = (mode: string, x: number, y: number, options: ContextMenuItem[]) => {
      let menuX = 0
      let menuY = 0
      if (mode === 'root') {
        menuX = x
        menuY = y
      }
      const menuItems = options
      contextMenuOptions.value = buildContextMenuData({
        x: menuX,
        y: menuY,
        menuItems,
        width: 160,
        itemHeight: 35,
        precision: 20,
        theme: appThemeMode.value,
      })
      // 显示菜单
      showContextMenu.value = true
    }

    const bindTocButtonClick = () => {
      detachTocButtonListener?.()
      detachTocButtonListener = null

      const tocButton = document.getElementById('titlebar-toc')
      if (!tocButton) {
        return
      }

      const handler = () => {
        tocDrawer.value = true
      }

      tocButton.addEventListener('click', handler)
      detachTocButtonListener = () => {
        tocButton.removeEventListener('click', handler)
      }
    }

    const handleDocumentPointerDown = (event: PointerEvent) => {
      if (!styleMenuVisible.value) {
        return
      }

      const target = event.target as HTMLElement | null
      if (isStyleMenuRelatedTarget(target)) {
        return
      }

      closeStyleMenu()
    }

    const handleReaderDomToggleStyleMenu = () => {
      void toggleStyleMenu()
    }

    const handleReaderDomCloseStyleMenu = () => {
      closeStyleMenu()
    }

    const handleOpenSystemFontDialog = () => {
      closeStyleMenu()
      systemFontDialogVisible.value = true
    }

    const handleWindowResize = () => {
      if (!styleMenuVisible.value) {
        return
      }

      void syncStyleMenuLayout()
    }

    watch(styleMenuVisible, (visible) => {
      setStyleMenuButtonActive(visible)
    })

    onMounted(async () => {
      // 加载阅读器配置
      await loadReaderConfig()

      // 监听键盘事件
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
      unlistenClosed.value?.()
      unlistenShowBookInfo.value?.()
      unlistenShowAssistant.value?.()
      unlistenShowHelp.value?.()
      detachTocButtonListener?.()
      detachTocButtonListener = null
      setStyleMenuButtonActive(false)
    })

    const styleMenuPanelStyle = computed(() => {
      return {
        top: `${styleMenuPosition.value.top}px`,
        left: `${styleMenuPosition.value.left}px`,
      }
    })

    return {
      pendingBookKey,
      nextPage,
      prevPage,
      currentBookFormat,
      txtParagraphs,
      onTxtScroll,
      currentBookKey,
      readerConfig,
      tocDrawer,
      tocMenuRef,
      toc,
      goToChapter,
      activeChapter,
      handleTocOpen,
      bookInfoVisible,
      showContextMenu,
      contextMenuOptions,
      readingPercentage,
      readingStatusText,
      bookMarkEditionVisible,
      bookMarkEditionContent,
      assistantVisible,
      helpVisible,
      systemFontDialogVisible,
      appThemeMode,
      delBookMark,
      styleMenuVisible,
      styleMenuPosition,
      styleMenuPanelRef,
      styleMenuPanelStyle,
      handleStyleMenuEnter,
      handleStyleMenuAfterEnter,
      handleOpenSystemFontDialog,
    }
  },
}
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

  #txt-reader {
    position: absolute;
    padding: 30px 0;
    width: 100%;
    height: calc(100vh - 60px);
    overflow-y: auto;
    background: var(--reader-background);
    color: var(--reader-text);

    #txt-reader-content {
      max-width: 860px;
      margin: 0 auto;
      padding: 0 28px 40px 28px;
      background: var(--reader-content-background);
      border: none;
      border-radius: 0;
      box-shadow: none;
      backdrop-filter: none;
      transition:
        background var(--duration-base) var(--easing-standard),
        border-color var(--duration-fast) var(--easing-standard),
        box-shadow var(--duration-fast) var(--easing-standard),
        backdrop-filter var(--duration-fast) var(--easing-standard);

      .txt-paragraph {
        margin: 0 0 1.1em 0;
        text-indent: 2em;
        white-space: pre-wrap;
        word-break: break-word;
      }
    }
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
