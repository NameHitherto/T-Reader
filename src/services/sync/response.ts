import type { MainTaskMessageType } from '@/services/notification'
import { isWebDavError } from '@/services/sync/errors'

// 判断错误是否为 WebDavError
export { isWebDavError }

// 根据状态码和操作类型返回消息类型
export const toHttpResponseType = (
  error: unknown,
  _fallbackOperation: 'delete' | 'upload' | 'download' | 'exists' | 'list' = 'delete',
): MainTaskMessageType => {
  if (!isWebDavError(error)) {
    return 'error'
  }

  // delete 场景下 404 表示已是期望状态
  if (error.operation === 'delete' && error.statusCode === 404) {
    return 'success'
  }

  if (error.statusCode === 401 || error.statusCode === 403) {
    return 'error'
  }

  if (error.statusCode >= 500) {
    return 'error'
  }

  if (error.statusCode === 0) {
    return 'error'
  }

  return 'error'
}

// 根据状态码返回用户友好的消息
export const toHttpResponseMessage = (error: unknown, context?: string): string => {
  if (!isWebDavError(error)) {
    return toLegacyErrorMessage(error)
  }

  const resource = context || error.resource

  switch (error.statusCode) {
    case 404:
      return `云端不存在该文件（${resource}），可能已被删除`
    case 401:
    case 403:
      return `云端认证失败，请检查 WebDAV 账号密码配置`
    case 500:
    case 502:
    case 503:
    case 504:
      return `云端服务暂不可用（HTTP ${error.statusCode}），请稍后重试`
    case 0:
      return `网络连接异常，请检查网络设置`
    default:
      return `操作失败：${error.message}`
  }
}

// 综合处理
export const toHttpResponseResult = (
  error: unknown,
  fallbackOperation: 'delete' | 'upload' | 'download' | 'exists' | 'list' = 'delete',
  context?: string,
): { type: MainTaskMessageType; message: string } => {
  return {
    type: toHttpResponseType(error, fallbackOperation),
    message: toHttpResponseMessage(error, context),
  }
}

// 处理 Promise.allSettled 结果
export const toSettledResponseResult = (
  result: PromiseSettledResult<unknown>,
  fallbackOperation: 'delete' | 'upload' | 'download' | 'exists' | 'list' = 'delete',
  context?: string,
): { type: MainTaskMessageType; message: string } | null => {
  if (result.status === 'fulfilled') {
    return null
  }
  return toHttpResponseResult(result.reason, fallbackOperation, context)
}

// 兼容旧的非结构化错误
const toLegacyErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return '发生未知异常'
}
