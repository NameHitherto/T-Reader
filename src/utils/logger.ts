import { error as logErrorFn, info as logInfoFn, warn as logWarnFn } from '@tauri-apps/plugin-log'

type LogPayload = Record<string, unknown> | undefined

const buildFallbackConsolePrefix = (level: 'ERROR' | 'WARN'): string => {
  const now = new Date()
  const time = now.toTimeString().slice(0, 8)

  return `[${time}][${level}]`
}

const emitFrontendLog = (logTask: Promise<void>) => {
  void logTask.catch((error) => {
    globalThis.console.error(
      `${buildFallbackConsolePrefix('ERROR')}[logger] failed-to-dispatch-tauri-log`,
      error,
    )
  })
}

const formatPayload = (payload?: LogPayload): string => {
  if (!payload) return ''
  try {
    return JSON.stringify(payload)
  } catch {
    return '[payload serialization failed]'
  }
}

const buildLogMessage = (scope: string, message: string, payload?: LogPayload): string => {
  const payloadStr = formatPayload(payload)
  const event = payloadStr ? `${message} ${payloadStr}` : message

  return `[${scope}] ${event}`
}

export const logInfo = (scope: string, message: string, payload?: LogPayload) => {
  emitFrontendLog(logInfoFn(buildLogMessage(scope, message, payload)))
}

export const logWarn = (scope: string, message: string, error?: unknown) => {
  const payload: LogPayload =
    error !== undefined
      ? { error: error instanceof Error ? error.message : String(error) }
      : undefined
  emitFrontendLog(logWarnFn(buildLogMessage(scope, message, payload)))
}

export const logError = (scope: string, message: string, err?: unknown, payload?: LogPayload) => {
  const combinedPayload: Record<string, unknown> = payload ? { ...payload } : {}
  if (err !== undefined) {
    combinedPayload.error = err instanceof Error ? err.message : String(err)
  }
  const normalizedPayload = Object.keys(combinedPayload).length > 0 ? combinedPayload : undefined
  emitFrontendLog(logErrorFn(buildLogMessage(scope, message, normalizedPayload)))
}
