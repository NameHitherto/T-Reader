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
          <path fill="#000000" d="m4 10l9 9l1.4-1.5L7 10l7.4-7.5L13 1z" />
        </svg>
      </button>
      <button class="next-page button" @click="nextPage">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 20 20"
        >
          <path fill="#000000" d="M7 1L5.6 2.5L13 10l-7.4 7.5L7 19l9-9z" />
        </svg>
      </button>
    </div>
  </div>
  <el-drawer v-model="tocDrawer" direction="ltr" :show-close="false" @open="handleTocOpen">
    <template #header>
      <span style="font-size: large; text-align: center">目录</span>
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
  <!-- 书籍详细信息展示 -->
  <book-info-dialog v-model="bookInfoVisible" :bookId="bookIsReading" />
  <!-- 右键菜单 -->
  <ContextMenu v-model:show="showContextMenu" :menu-data="contextMenuOptions" />
  <!-- 笔记编辑框 -->
  <BookMarkDialog v-model="bookMarkEditionVisible" v-model:book-mark-list="bookMarkEditionContent" @delete="(markId: string) => delBookMark(markId)"/>
  <!-- AI助手 -->
  <AssistantDialog v-model="assistantVisible" :bookId="bookIsReading"/>
  <!-- 阅读进度 -->
  <div v-if="readingPercentage" class="reading-percentage">
    {{ readingPercentage }}%
  </div>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { readFile, BaseDirectory, writeFile } from '@tauri-apps/plugin-fs'
import ePub, { Rendition } from 'libs/epub.js'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useReaderConfigStore } from './store/readerConfigStore'
import { storeToRefs } from 'pinia'
import BookInfoDialog from './components/BookInfoDialog/index.vue'
import ContextMenu from './components/ContextMenu/index.vue'
import BookMarkDialog from './components/BookMark/bookMarkDialog.vue'
import AssistantDialog from './components/AssistantDialog/index.vue'
import TocMenu from './components/TocMenu/index.vue'
import { BookConfig, ContextMenuData, ContextMenuItem } from './js/map'
import { useBookMarkStore, BookMark } from './store/bookMark'
import { generateID, formatDate } from './js/utils'
import { ElLoading } from 'element-plus'
import 'element-plus/es/components/loading/style/css'

export default {
  name: 'ReaderApp',
  components: {
    BookInfoDialog,
    ContextMenu,
    BookMarkDialog,
    AssistantDialog,
    TocMenu,
  },
  setup() {
    // 阅读时书籍ID
    const bookIsReading = ref<string | null>(null)
    // 加载时书籍ID
    const bookId = ref<string | null>(null)
    // 书籍信息
    const bookInfoVisible = ref(false)
    // 用于存储EPUB渲染对象
    const rendition = ref<Rendition | null>(null)
    // 用于存储解除监听函数
    let unlistenBook = ref<UnlistenFn | null>(null)
    // 用于存储解除监听函数
    let unlistenClosed = ref<UnlistenFn | null>(null)
    // 用于存储解除监听函数
    let unlistenStyle = ref<UnlistenFn | null>(null)
    // 正式全局变量
    const readerConfigStore = useReaderConfigStore()
    // 全局状态变量，但只能访问不能修改
    const { readerConfig } = storeToRefs(readerConfigStore)
    // 目录抽屉是否显示
    const tocDrawer = ref(false)
    // 目录菜单引用
    const tocMenuRef = ref<any>(null)
    // 目录信息
    const toc = ref<any[]>([])
    // 当前章节
    const activeChapter = ref<string>('')
    // 右键笔记菜单
    const showContextMenu = ref(false)
    // 右键菜单选项
    const contextMenuOptions = ref({} as ContextMenuData)
    // 当前选中的文本
    const selectedText = ref<string>('')
    // 选中文本的Range对象
    const selectedRange = ref<string | null>(null)
    // 阅读进度百分比
    const readingPercentage = ref('')
    // 阅读注释笔记
    const bookMarkStore = useBookMarkStore()
    // 全局状态变量，但只能访问不能修改
    const { bookMarks } = storeToRefs(bookMarkStore)
    // 笔记编辑框是否显示
    const bookMarkEditionVisible = ref(false)
    // 笔记编辑内容
    const bookMarkEditionContent = ref<string>('')
    // 默认高亮颜色
    const defaultHighlightColor = '#6b7280'
    // 监听笔记编辑内容
    watch(bookMarkEditionContent, (newVal) => {
      if (newVal) {
        const updated = JSON.parse(newVal)
        // 更新bookMarkStore
        bookMarkStore.updateBookMark(updated)
        // 更新笔记高亮颜色和边框
        if (rendition.value) {
          rendition.value?.annotations.remove(updated.bookCfi, 'highlight')
          rendition.value?.annotations.add(
            'highlight',
            updated.bookCfi,
            {markId: updated.id},
            undefined,
            'bookmark-highlight',
            {
              fill: updated.color || defaultHighlightColor,
              stroke: updated.hasBorder ? '#000' : 'none',
            }
          )
        }
      }
    })
    // AI助手是否显示
    const assistantVisible = ref(false)

    // 阅读器动态样式
    const readerDefaultTheme = computed(() => {
      const themeReturned = {
        'body': {
          'font-family': `${readerConfig.value.font}`,
          'font-size': `${readerConfig.value.fontSize}px`,
          'font-weight': readerConfig.value.fontWeight,
          'padding-top': `${readerConfig.value.headerMargin}px !important`,
          'padding-bottom': `${readerConfig.value.footerMargin}px !important`,
        },
        'h1': {
          'color': `${readerConfig.value.fontColor}`,
        },
        'h2': {
          'color': `${readerConfig.value.fontColor}`,
        },
        'h3': {
          'color': `${readerConfig.value.fontColor}`,
        },
        'p': {
          'color': `${readerConfig.value.fontColor}`,
          'line-height': `${readerConfig.value.lineSpacing}em`,
          'margin-bottom': `${readerConfig.value.paragraphSpacing}em`,
          'text-indent': `${readerConfig.value.indent}em`,
        },
        'font': {
          'color': `${readerConfig.value.fontColor}`,
        },
        '::selection': {
          'background': 'rgb(0 0 0 / 25%)',
          'color': 'rgb(0 0 0 / 75%)',
        },
        'html': {
          'cursor': `url('/src/assets/cursor/pointer.cur'), default`,
        },
        '@font-face': {
          'font-family': `${readerConfig.value.font}`,
          'src': `url("/src/font/${readerConfig.value.font}.ttf") format("truetype")`,
        },
      }
      return themeReturned
    })

    // 加载或更新阅读器样式
    const applyReaderStyle = async () => {
      // 背景颜色
      document.body.style.backgroundColor = readerConfig.value.color
      if (readerConfig.value.color === '#000000') {
        // 图标颜色反转
        document.querySelectorAll('img').forEach((img) => {
          img.style.filter = 'invert(1)'
        })
        // 按钮悬浮效果,根据类名选择
        document
          .querySelectorAll('.titlebar-front-button')
          .forEach((button) => {
            button.classList.add('dark')
          })
        document.querySelectorAll('.titlebar-button').forEach((button) => {
          button.classList.add('dark')
        })
        document.querySelectorAll('.button').forEach((button) => {
          button.classList.add('dark')
        })
      } else {
        document.querySelectorAll('img').forEach((img) => {
          img.style.filter = 'invert(0)'
        })
        document
          .querySelectorAll('.titlebar-front-button')
          .forEach((button) => {
            button.classList.remove('dark')
          })
        document.querySelectorAll('.titlebar-button').forEach((button) => {
          button.classList.remove('dark')
        })
        document.querySelectorAll('.button').forEach((button) => {
          button.classList.remove('dark')
        })
      }

      // 阅读器样式
      rendition.value?.themes.default(readerDefaultTheme.value)
      // 阅读器翻页模式
      rendition.value?.flow(readerConfig.value.flow)
      // 刷新呈现，应用更改
      rendition.value?.layout(null)
    }

    // 读取配置文件
    const loadReaderConfig = async () => {
      try {
        const configData = await readFile('T-Reader/ReaderConfig.json', {
          baseDir: BaseDirectory.Document,
        })
        const configTemp = JSON.parse(new TextDecoder().decode(configData))
        readerConfigStore.setReaderConfig(configTemp)
      } catch (e) {
        console.log(e)
      }
    }

    // 保存配置文件
    const saveReaderConfig = async () => {
      await invoke('save_file', {
        filename: 'ReaderConfig.json',
        contents: JSON.stringify(readerConfig.value),
      })
    }

    // 保存阅读进度
    const saveReaderRendition = async () => {
      if (rendition.value && bookIsReading.value) {
        const currentLocation = rendition.value.currentLocation()
        if (currentLocation) {
          const cfi = currentLocation.start.cfi
          // 配置文件
          let bookConfigData
          try {
            // 尝试获取云同步配置文件
            const cloudConfigData = await invoke('webdav_get', {
              filename: `${bookIsReading.value}.json`,
            })
            bookConfigData = new Uint8Array(cloudConfigData as ArrayBufferLike)
          } catch (e) {
            // 获取云同步配置文件失败，使用本地配置文件
            bookConfigData = await readFile(
              `T-Reader/${bookIsReading.value}.json`,
              { baseDir: BaseDirectory.Document }
            )
          }
          const bookConfig: BookConfig = JSON.parse(
            new TextDecoder().decode(bookConfigData)
          )
          // 覆盖上次阅读时间
          bookConfig.lastRead = new Date().toLocaleDateString()
          // 覆盖阅读进度
          bookConfig.location = cfi
          // 覆盖阅读笔记
          if (bookMarks.value.length > 0) {
            bookConfig.bookMarks = bookMarks.value.filter((mark: BookMark) => mark.bookId === bookIsReading.value)
          }
          const jsonString = JSON.stringify(bookConfig)
          const jsonUint8Array = new TextEncoder().encode(jsonString)
          await invoke('save_file', {
            filename: `${bookIsReading.value}.json`,
            contents: jsonString,
          })
          await invoke('webdav_upload', {
            filename: `${bookIsReading.value}.json`,
            contents: Array.from(jsonUint8Array),
          })
        }
      }
    }

    // 初始化所有笔记
    const initAllBookMarks = async () => {
      bookMarks.value.forEach((bookMark: BookMark) => {
        if (bookMark.bookId === bookIsReading.value) {
          rendition.value?.annotations.remove(bookMark.bookCfi, 'highlight')
          rendition.value?.annotations.add(
            'highlight',
            bookMark.bookCfi,
            {'markId': bookMark.id},
            undefined,
            'bookmark-highlight',
            {
              fill: bookMark.color ? bookMark.color : defaultHighlightColor,
              stroke: bookMark.hasBorder ? '#000' : 'none',
            }
          )
        }
      })
    }

    // 添加笔记
    const addBookMark = async () => {
      const tempId = generateID(3)
      const bookMark: BookMark = {
        id: tempId,
        bookId: bookIsReading.value ? bookIsReading.value : '',
        bookCfi: selectedRange.value ? selectedRange.value : '',
        bookTitle: (await rendition.value?.book?.loaded?.metadata)?.title || '未知书籍',
        content: selectedText.value,
        createTime: formatDate(new Date()),
      }
      bookMarkStore.addBookMark(bookMark)
      rendition.value?.annotations.add(
        'highlight',
        selectedRange.value ? selectedRange.value : '',
        {'markId': tempId},
        undefined,
        'bookmark-highlight',
        {
          fill: defaultHighlightColor, // 初始默认高亮颜色
        }
      )
      return tempId
    }

    // 添加笔记并评论
    const addBookMarkComment = async () => {
      const bookMarkId = await addBookMark()
      bookMarkEditionContent.value = JSON.stringify(bookMarkStore.getBookMark(bookMarkId)[0])
      bookMarkEditionVisible.value = true
    }

    // 删除笔记
    const delBookMark = async (markId: string) => {
      const bookMark = bookMarkStore.getBookMark(markId)[0]
      rendition.value?.annotations.remove(bookMark.bookCfi, 'highlight')
      bookMarkStore.removeBookMark(markId)
      bookMarkEditionVisible.value = false
    }

    // 监听主程序发送的书籍ID
    listen<any>('load-book-id', async (event) => {
      // 保存之前的阅读进度
      await saveReaderRendition()
      // 加载新书籍
      bookId.value = event.payload.id
      if (event.payload.cfi !== ''){
        await loadBook(event.payload.cfi)
      }else {
        await loadBook()
      }
    }).then((fn) => {
      unlistenBook.value = fn
    })

    // 监听显示书籍信息
    listen('show-book-info', () => {
      bookInfoVisible.value = true
    })

    // 监听显示AI助手
    listen('show-assistant', () => {
      assistantVisible.value = true
    })

    // 监听样式调整
    listen('update-reader-style', async () => {
      await applyReaderStyle()
    }).then((fn) => {
      unlistenStyle.value = fn
    })

    // 监听阅读器窗口关闭
    getCurrentWindow()
      .onCloseRequested(async () => {
        // 保存阅读进度
        await saveReaderRendition()
        // 保存全局配置
        await saveReaderConfig()
      })
      .then((fn) => {
        unlistenClosed.value = fn
      })

    // 告知主程序已准备好接受书籍ID
    getCurrentWebviewWindow().emitTo('main', 'ready-to-receive-book-id')

    // 处理Rendition事件
    const handleRenditionEvents = () => {
      if (rendition.value) {
        // 页面重新排版
        rendition.value.on('relocated', (location: any) => {
          // 更新当前章节href
          if (location.start) {
            activeChapter.value = location.end.href
          } 
          // 更新阅读进度百分比
          const percentage = location.start.percentage
          if (percentage) {
            readingPercentage.value = (percentage * 100).toFixed(1)
          }
        })

        // 监听文本选择
        rendition.value.on('selected', (cfiRange: any, contents: any) => {
          // 更新选中文本
          selectedText.value = contents.window.getSelection().toString()
          // 更新选中文本的Range对象
          selectedRange.value = cfiRange
        })

        // 监听键盘事件
        rendition.value.on('keydown', (event: any) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            prevPage()
          } else if (
            event.key === 'ArrowRight' ||
            event.key === 'ArrowDown'
          ) {
            nextPage()
          }
        })

        // 监听点击事件
        rendition.value.on('click', () => {
          // 如果此时样式菜单已打开，则关闭
          document.getElementById('customer-menu')?.remove()
          const frontButtons = document.getElementsByClassName(
            'titlebar-front-button'
          )
          for (let i = 0; i < frontButtons.length; i++) {
            frontButtons[i].classList.remove('active')
          }
          // 关闭右键菜单
          showContextMenu.value = false
        })

        // 注释点击事件
        rendition.value.on('markClicked', (_cfiRange: string, data: any, _contents: any) => {
          bookMarkEditionContent.value = JSON.stringify(bookMarkStore.getBookMark(data.markId)[0])
          bookMarkEditionVisible.value = true
        })

        // 利用钩子注册脚本和事件
        rendition.value.hooks.content.register(function(contents: any) {
          // 监听右键事件
          contents.document.addEventListener('contextmenu', function(event: PointerEvent) {
            event.preventDefault();
            const selection = contents.window.getSelection();
            if (selection.toString()) {
              const range = selection.getRangeAt(0);
              const rect = range.getBoundingClientRect()
              if (
                event.clientX >= rect.left &&
                event.clientX <= rect.right &&
                event.clientY >= rect.top &&
                event.clientY <= rect.bottom
              ) {
                // 找到唯一的目标iframe
                const iframeWindow = contents.window;
                let targetIframe: HTMLIFrameElement | null = null;
                const iframes = document.querySelectorAll('iframe');
                for (let i = 0; i < iframes.length; i++) {
                  const iframe = iframes[i] as HTMLIFrameElement;
                  if (iframe.contentWindow === iframeWindow) {
                    targetIframe = iframe;
                    break;
                  }
                }
                if (!targetIframe) {
                  console.log('未找到目标iframe')
                  return;
                }
                // 计算iframe位置
                const iframeRect = targetIframe.getBoundingClientRect();
                // 计算绝对坐标
                const absoluteX = iframeRect.left + event.clientX;
                const absoluteY = iframeRect.top + event.clientY;

                // 菜单选项
                const menuItems: ContextMenuItem[] = [
                  {
                    label: '标记 | 添加标签',
                    type: 'bookmark',
                    onClick: () => addBookMark(),
                  },
                  {
                    label: '注释 | 个人评论',
                    type: 'comment',
                    onClick: () => addBookMarkComment(),
                  },
                ]
                // 显示菜单
                openContextMenu('root', absoluteX, absoluteY, menuItems)
              } else {
                showContextMenu.value = false
              }
            } else {
              showContextMenu.value = false
            }
          })
          // 添加脚本
          // const script = document.createElement('script');
          // script.innerHTML = iframeContent;
          // script.type = 'text/javascript';
          // contents.document.head.appendChild(script);
          return contents;
        })
      }
    }

    // 加载书籍
    const loadBook = async (cfi? : string) => {
      if (!bookId.value) {
        setTimeout(loadBook, 500) // 500ms 后再次尝试加载书籍
        return
      }
      // 自用书籍ID备份
      bookIsReading.value = bookId.value
      // 书籍加载完毕书籍ID置空，防止浏览器缓存
      bookId.value = null

      // 开始加载
      const loading = ElLoading.service({
        lock: true,
        text: '正在加载书籍...',
        background: 'rgba(0, 0, 0, 0.7)',
      })

      try {
        let bookConfigData
        try {
          // 尝试获取云同步配置文件
          const cloudConfigData = await invoke('webdav_get', {
            filename: `${bookIsReading.value}.json`,
          })
          bookConfigData = new Uint8Array(cloudConfigData as ArrayBufferLike)
          console.log('使用云同步配置文件')
        } catch (e) {
          // 获取云同步配置文件失败，使用本地配置文件
          bookConfigData = await readFile(
            `T-Reader/${bookIsReading.value}.json`,
            { baseDir: BaseDirectory.Document }
          )
          console.log('使用本地配置文件')
        }
        const bookConfig = JSON.parse(new TextDecoder().decode(bookConfigData))

        let bookData
        try {
          // 尝试读取本地书籍信息
          bookData = await readFile(`T-Reader/${bookIsReading.value}.epub`, {
            baseDir: BaseDirectory.Document,
          })
          console.log('使用本地书籍信息')
        } catch (e) {
          // 读取本地书籍信息失败，尝试获取云同步文件的 EPUB 资源
          const cloudBookData = await invoke('webdav_get', {
            filename: `${bookIsReading.value}.epub`,
          })
          bookData = new Uint8Array(cloudBookData as ArrayBufferLike)
          console.log('使用云同步书籍信息')

          // 将云同步文件复制到本地
          await writeFile(`T-Reader/${bookIsReading.value}.epub`, bookData, {
            baseDir: BaseDirectory.Document,
          })
          console.log('云同步书籍信息已复制到本地')
        }
        const bookArrayBuffer = bookData.buffer

        try {
          // 检查并安全销毁旧的rendition
          if (rendition.value) {
            console.log('开始销毁旧的Rendition')
            if (rendition.value.hooks && rendition.value.hooks.content) {
              rendition.value.hooks.content.clear();
            }

            try {
              rendition.value.destroy()
            } catch (e) {
              console.log('销毁旧的Rendition失败', e)
            }

            rendition.value = null
          }

          // 解析并呈现 EPUB 内容
          const ePubBook = ePub(bookArrayBuffer as ArrayBuffer)

          // 确保 ePubBook已完全加载
          await ePubBook.ready;

          // 清空epub-reader容器
          const epubReader = document.getElementById('epub-reader');
          if (epubReader) {
            epubReader.innerHTML = '';
          }

          // 创建新的 Rendition 对象
          rendition.value = ePubBook.renderTo('epub-reader', {
            width: '100%',
            height: '100%',
            manager: 'continuous',
            flow: readerConfig.value.flow,
            spread: 'true',
            allowScriptedContent: true,
          })

          // 恢复阅读进度
          const savedLocation = bookConfig.location
          if (cfi) {
            console.log('使用笔记位置cfi:', cfi)
            // 笔记位置
            try {
              rendition.value.display(cfi)
            }catch (e) {
              console.log(e)
            }
          } else {
            console.log('使用自动保存位置cfi:', savedLocation)
            if (savedLocation) {
              rendition.value.display(savedLocation)
            } else {
              rendition.value.display()
            }
          }

          // 等待书籍加载完成
          await ePubBook.ready

          // 生成位置索引
          ePubBook.locations.generate(1000)

          // 挂载事件监听器
          handleRenditionEvents()

          // 获取书籍目录
          const tocData = await ePubBook.loaded.navigation
          toc.value = tocData.toc

          // 应用阅读器样式
          await applyReaderStyle()

          // 此时允许查看书籍目录
          document
            .getElementById('titlebar-toc')
            ?.addEventListener('click', () => (tocDrawer.value = true))

          // 生成笔记注释
          if (bookConfig.bookMarks !== undefined && bookConfig.bookMarks.length > 0) {
            bookMarkStore.importBookMark(bookConfig.bookMarks)
            await initAllBookMarks()
          }

          // 关闭加载动画
          loading.close()
        } catch (e) {
          console.log('EPUB解析失败', e)
          loading.close()
        }
      } catch (e) {
        console.log(e)
        loading.close()
      }
    }

    // 目录打开的回调
    const handleTocOpen = () => {
      // 当前章节的所有上级navItem的href(index)集
      let indexGroup: string[] = []
      const book = rendition.value?.book
      
      if (book) {
        // 定义递归解析函数
        function parseParentNavItem(nav: any) {
          if (nav && nav.parent && nav.parent !== undefined) {
            const parentNavItem = book?.navigation.get(`#${nav.parent}`)
            if (parentNavItem) {
              indexGroup.push(parentNavItem.href)
              parseParentNavItem(parentNavItem)
            }
          }
          return;
        }
        const currentNavItem = book.navigation.get(activeChapter.value)
        if (currentNavItem) {
          parseParentNavItem(currentNavItem)
        }
      }
      // 打开当前章节的所有上级菜单
      if (tocMenuRef.value && typeof tocMenuRef.value.open === 'function') {
        for (const index of indexGroup) {
          tocMenuRef.value.open(index)
        }
      }
      // 滚动到当前章节
      setTimeout(() => {
        scrollToCurrentChapter()
      }, 500)
    }

    // 上一章
    const prevPage = () => {
      if (rendition.value) {
        rendition.value.prev()
      }
    }
    // 下一章
    const nextPage = () => {
      if (rendition.value) {
        rendition.value.next()
      }
    }
    // 跳转到指定章节
    const goToChapter = (href: string) => {
      if (rendition.value) {
        rendition.value.display(href)
        tocDrawer.value = false
        activeChapter.value = href
      }
    }
    // 滚动到当前章节
    const scrollToCurrentChapter = () => {
      const scrollbar = document.querySelector('.el-drawer__body')
      const targetChapter = document.querySelector('.el-menu-item.is-active')
      if (scrollbar && targetChapter) {
        const targetRect = targetChapter.getBoundingClientRect()
        const drawerRect = scrollbar.getBoundingClientRect()
        const scrollTop = targetRect.top - drawerRect.top + scrollbar.scrollTop
        scrollbar.scrollTo({
          top: scrollTop,
          behavior: 'auto',
        })
      }
    }

    // 监听键盘方向事件
    const keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        prevPage()
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextPage()
      }
    }

    // 打开自定义右键菜单
    const openContextMenu = (mode: string, x: number, y:number, options: ContextMenuItem[]) => {
      let menuX = 0 
      let menuY = 0
      if (mode === 'root') {
        menuX = x
        menuY = y
      }
      const menuItems = options
      const menuWidth = 160 // 菜单宽度
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
      contextMenuOptions.value = {
        x: menuX,
        y: menuY,
        width: menuWidth,
        items: menuItems,
        theme: 'light',
      }
      // 显示菜单
      showContextMenu.value = true
    }

    onMounted(async () => {
      // 加载阅读器配置
      await loadReaderConfig()

      // 监听键盘事件
      document.addEventListener('keydown', keydownHandler)
    })

    onUnmounted(() => {})

    return {
      bookId,
      nextPage,
      prevPage,
      bookIsReading,
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
      bookMarkEditionVisible,
      bookMarkEditionContent,
      assistantVisible,
      delBookMark,
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
  background-color: var(--t-color-grey); /* 浅色背景 */
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

.reader {
  width: 100%;
  height: 100%;

  #epub-reader {
    position: absolute;
    padding: 30px 0px 30px 0px;
    width: 100%;
    height: calc(100vh - 60px);
  }

  /* 滚动条样式 */
  #epub-reader :deep(.epub-container) {
    overflow-x: hidden !important;
  }
  #epub-reader :deep(.epub-container)::-webkit-scrollbar {
    width: 12px;
  }
  #epub-reader :deep(.epub-container)::-webkit-scrollbar-track {
    background: transparent;
  }
  #epub-reader :deep(.epub-container)::-webkit-scrollbar-thumb {
    background-color: var(--t-color-grey); /* 浅色背景 */
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
      background-color: rgba(0, 0, 0, 0.1); /* 浅色背景 */
      color: #585858;
      border: none;
      border-radius: 6px;
      padding: 15px;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: auto;

      &:hover {
        opacity: 1;
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

    .button.dark {
      background: #e8e8e8;

      &:hover {
        opacity: 0.5;
      }
    }
  }
}

.reading-percentage {
  position: fixed;
  bottom: 15px;
  line-height: 15px;
  left: 50px;
  color: var(--t-color-dark-grey);
  font-weight: bold;
}
</style>
