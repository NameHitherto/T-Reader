import { invoke } from '@tauri-apps/api/core'
import {
  downloadBookFileToLocal,
  hasLocalBookFile,
  resolveBookFile,
} from '@/services/book/bookRepository'
import { getLocalDirNames } from '@/services/fileSystem/dirService'
import { showMainTaskMessage } from '@/services/notification/mainTaskMessageService'
import { openReaderWindow } from '@/services/reader/readerWindowBridgeService'

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
  await openReaderWindow(bookKey, cfi)
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
      title: '打开阅读器失败',
      message: toTaskErrorMessage(error),
      taskKey: `reader-open:${bookKey}`,
    })
  }
}
