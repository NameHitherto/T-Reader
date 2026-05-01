import { h } from 'vue'
import { ElMessage } from 'element-plus'
import type { MessageHandler } from 'element-plus'
import 'element-plus/es/components/message/style/css'

export type MainTaskMessageType = 'success' | 'warning' | 'info' | 'error'

const MESSAGE_CLASS = 'main-task-message'
const DEFAULT_DURATION = 2000

export interface ShowMainTaskMessageOptions {
  type: MainTaskMessageType
  title: string
  message: string
  taskKey?: string
  duration?: number
}

export interface CreateMainTaskBatchNotifierOptions {
  taskKey: string
  successTitle: string
  partialFailureTitle: string
  errorTitle: string
  duration?: number
  actionLabel?: string
}

export interface MainTaskBatchNotifier {
  registerTask: (label: string) => void
  recordSuccess: (label: string) => void
  recordFailure: (label: string, reason?: string) => void
  flushWhenComplete: () => void
}

interface ActiveMainTaskMessage {
  taskKey?: string
  handler: MessageHandler
}

interface BatchFailure {
  label: string
  reason?: string
}

const taskMessageMap = new Map<string, ActiveMainTaskMessage>()

const cleanupTaskMessage = (taskKey?: string) => {
  if (!taskKey) {
    return
  }

  taskMessageMap.delete(taskKey)
}

const toMessageVNode = (title: string, message: string) => {
  return h('div', { class: `${MESSAGE_CLASS}__body` }, [
    h('div', { class: `${MESSAGE_CLASS}__title` }, title),
    h('div', { class: `${MESSAGE_CLASS}__text` }, message),
  ])
}

const formatBookLabels = (labels: string[]): string => {
  const visibleLabels = labels.slice(0, 2).map((label) => `《${label}》`)
  if (labels.length <= 2) {
    return visibleLabels.join('、')
  }

  return `${visibleLabels.join('、')} 等 ${labels.length} 本书`
}

const buildBatchMessage = (
  options: CreateMainTaskBatchNotifierOptions,
  successLabels: string[],
  failureEntries: BatchFailure[]
): { type: MainTaskMessageType; title: string; message: string } | null => {
  const successCount = successLabels.length
  const failureCount = failureEntries.length
  const totalCount = successCount + failureCount
  const actionLabel = options.actionLabel || '后台同步'

  if (totalCount === 0) {
    return null
  }

  if (failureCount === 0) {
    if (successCount === 1) {
      return {
        type: 'success',
        title: options.successTitle,
        message: `${formatBookLabels(successLabels)}已完成${actionLabel}。`,
      }
    }

    return {
      type: 'success',
      title: options.successTitle,
      message: `${successCount} 本书已完成${actionLabel}。`,
    }
  }

  if (successCount === 0) {
    const firstFailure = failureEntries[0]
    const reasonSuffix = firstFailure?.reason ? `，原因：${firstFailure.reason}` : ''
    if (failureCount === 1) {
      return {
        type: 'error',
        title: options.errorTitle,
        message: `${formatBookLabels([firstFailure.label])}${actionLabel}失败${reasonSuffix}。`,
      }
    }

    return {
      type: 'error',
      title: options.errorTitle,
      message: `${failureCount} 本书${actionLabel}失败。`,
    }
  }

  const firstFailureReason = failureEntries[0]?.reason
  const failureSummary = firstFailureReason ? ` 首个失败原因：${firstFailureReason}` : ''

  return {
    type: 'warning',
    title: options.partialFailureTitle,
    message: `${successCount} 本书已完成${actionLabel}，${failureCount} 本书同步失败。${failureSummary}`.trim(),
  }
}

const closeTaskMessageIfExists = (taskKey?: string) => {
  if (!taskKey) {
    return
  }

  const activeMessage = taskMessageMap.get(taskKey)
  if (!activeMessage) {
    return
  }

  activeMessage.handler.close()
}

export const showMainTaskMessage = (
  options: ShowMainTaskMessageOptions
): MessageHandler => {
  closeTaskMessageIfExists(options.taskKey)

  const handler = ElMessage({
    type: options.type,
    duration: options.duration ?? DEFAULT_DURATION,
    showClose: true,
    placement: 'bottom-right',
    offset: 24,
    customClass: `${MESSAGE_CLASS} ${MESSAGE_CLASS}--${options.type}`,
    message: toMessageVNode(options.title, options.message),
    onClose: () => cleanupTaskMessage(options.taskKey),
  })

  if (options.taskKey) {
    taskMessageMap.set(options.taskKey, {
      taskKey: options.taskKey,
      handler,
    })
  }

  return handler
}

export const createMainTaskBatchNotifier = (
  options: CreateMainTaskBatchNotifierOptions
): MainTaskBatchNotifier => {
  let pendingCount = 0
  let shouldFlushWhenComplete = false
  let flushed = false

  const successLabels: string[] = []
  const failureEntries: BatchFailure[] = []

  const tryFlush = () => {
    if (!shouldFlushWhenComplete || flushed || pendingCount > 0) {
      return
    }

    const result = buildBatchMessage(options, successLabels, failureEntries)
    flushed = true
    if (!result) {
      return
    }

    showMainTaskMessage({
      ...result,
      taskKey: `${options.taskKey}:summary`,
      duration: options.duration,
    })
  }

  return {
    registerTask(label: string) {
      if (!label) {
        return
      }

      pendingCount += 1
    },
    recordSuccess(label: string) {
      successLabels.push(label)
      pendingCount = Math.max(0, pendingCount - 1)
      tryFlush()
    },
    recordFailure(label: string, reason?: string) {
      failureEntries.push({
        label,
        reason,
      })
      pendingCount = Math.max(0, pendingCount - 1)
      tryFlush()
    },
    flushWhenComplete() {
      shouldFlushWhenComplete = true
      tryFlush()
    },
  }
}
