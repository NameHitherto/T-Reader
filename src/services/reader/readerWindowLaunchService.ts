import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { invoke } from '@tauri-apps/api/core'
import { WINDOW_EVENTS } from '@/constants/events'
import {
  downloadBookFileToLocal,
  hasLocalBookFile,
  resolveBookFile,
} from '@/services/book/bookRepository'
import { getLocalDirNames } from '@/services/fileSystem/dirService'
import { showMainTaskMessage } from '@/services/notification/mainTaskMessageService'

let unlistenReady: UnlistenFn | null = null

const readerWindowMinWidth = 880
const readerWindowMinHeight = 660

const toTaskErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return '发生未知异常'
}

const launchReaderWindow = async (bookKey: string, cfi = '') => {
  const webview = new WebviewWindow('reader', {
    url: 'reader.html',
    title: '阅读',
    decorations: false,
    minHeight: readerWindowMinHeight,
    minWidth: readerWindowMinWidth,
  })

  webview.once('tauri://created', async () => {
    unlistenReady?.()
    unlistenReady = await listen<string>(WINDOW_EVENTS.READY_TO_RECEIVE_BOOK_KEY, async () => {
      WebviewWindow.getCurrent().emitTo('reader', WINDOW_EVENTS.LOAD_BOOK_KEY, {
        bookKey,
        cfi,
      })
    })
  })

  webview.once('tauri://error', () => {
    WebviewWindow.getCurrent().emitTo('reader', WINDOW_EVENTS.LOAD_BOOK_KEY, {
      bookKey,
      cfi,
    })
  })
}

export const openReaderWindowWithPrecheck = async (bookKey: string, cfi = ''): Promise<void> => {
  try {
    const resolvedBookFile = await resolveBookFile(bookKey)
    const localExists = await hasLocalBookFile(resolvedBookFile.fileName)
    if (localExists) {
      await launchReaderWindow(bookKey, cfi)
      return
    }

    const dirs = await getLocalDirNames()
    const existsInCloud = await invoke<boolean>('webdav_exists', {
      subdir: dirs.books,
      filename: resolvedBookFile.fileName,
    })

    if (!existsInCloud) {
      showMainTaskMessage({
        type: 'error',
        title: '文件缺失',
        message: '未能找到对应的本地或云端书籍文件。',
        taskKey: `reader-open:${bookKey}`,
      })
      return
    }

    showMainTaskMessage({
      type: 'warning',
      title: '正在下载书籍',
      message: '本地文件缺失，正在从云端下载后打开阅读器。',
      taskKey: `reader-open:${bookKey}`,
      duration: 2500,
    })

    await downloadBookFileToLocal(bookKey)
    await launchReaderWindow(bookKey, cfi)
  } catch (error) {
    showMainTaskMessage({
      type: 'error',
      title: '文件缺失',
      message: toTaskErrorMessage(error),
      taskKey: `reader-open:${bookKey}`,
    })
  }
}
