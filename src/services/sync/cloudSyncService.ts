import { invoke } from '@tauri-apps/api/core'
import type {
  CloudSyncApplyRequest,
  CloudSyncApplyResult,
  CloudSyncBookAction,
  CloudSyncPreviewItem,
  CloudSyncPreviewResult,
} from '@/types/sync'

export const EMPTY_CLOUD_SYNC_PREVIEW: CloudSyncPreviewResult = {
  bookItems: [],
  normalCount: 0,
  uploadCount: 0,
  downloadCount: 0,
}

export const toCloudSyncErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return '发生未知异常'
}

export const getCloudSyncPreview = async (): Promise<CloudSyncPreviewResult> => {
  return await invoke<CloudSyncPreviewResult>('webdav_get_sync_preview')
}

export const applyCloudSyncPlan = async (
  request: CloudSyncApplyRequest
): Promise<CloudSyncApplyResult> => {
  return await invoke<CloudSyncApplyResult>('webdav_apply_sync_plan', {
    request,
  })
}

export const buildDefaultCloudSyncSelectionMap = (
  items: CloudSyncPreviewItem[]
): Record<string, boolean> => {
  return Object.fromEntries(
    items.map((item) => [item.fileName, item.status === 'download'])
  )
}

const toBookAction = (status: CloudSyncPreviewItem['status']): CloudSyncBookAction | null => {
  if (status === 'upload' || status === 'download') {
    return status
  }

  return null
}

export const buildCloudSyncApplyRequest = (
  items: CloudSyncPreviewItem[],
  selectionMap: Record<string, boolean>
): CloudSyncApplyRequest => {
  const bookSelections = items.flatMap((item) => {
    if (!selectionMap[item.fileName]) {
      return []
    }

    const action = toBookAction(item.status)
    if (!action) {
      return []
    }

    return [
      {
        fileName: item.fileName,
        action,
      },
    ]
  })

  return {
    bookSelections,
  }
}

export const formatCloudSyncResultMessage = (result: CloudSyncApplyResult): string => {
  const summaryParts = [
    `书籍上传 ${result.uploadedBookCount} 本`,
    `书籍下载 ${result.downloadedBookCount} 本`,
    `进度上传 ${result.uploadedConfigCount} 项`,
    `进度下载 ${result.downloadedConfigCount} 项`,
  ]

  if (result.replacedConfigCount > 0) {
    summaryParts.push(`较新进度覆盖 ${result.replacedConfigCount} 项`)
  }

  if (result.skippedCount > 0) {
    summaryParts.push(`跳过 ${result.skippedCount} 项`)
  }

  const changedCount =
    result.uploadedBookCount +
    result.downloadedBookCount +
    result.uploadedConfigCount +
    result.downloadedConfigCount

  if (changedCount === 0) {
    return result.skippedCount > 0
      ? '没有新的同步变更，已跳过状态失效项。'
      : '没有需要处理的书籍差异，进度配置已检查完成。'
  }

  return `${summaryParts.join('，')}。`
}
