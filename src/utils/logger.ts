type LogPayload = Record<string, unknown> | undefined

const buildPrefix = (scope: string, message: string): string => {
  return `[frontend][${scope}] ${message}`
}

const now = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }

  return Date.now()
}

export const logInfo = (scope: string, message: string, payload?: LogPayload) => {
  if (payload) {
    console.info(buildPrefix(scope, message), payload)
    return
  }

  console.info(buildPrefix(scope, message))
}

export const logWarn = (scope: string, message: string, payload?: LogPayload) => {
  if (payload) {
    console.warn(buildPrefix(scope, message), payload)
    return
  }

  console.warn(buildPrefix(scope, message))
}

export const logError = (
  scope: string,
  message: string,
  error?: unknown,
  payload?: LogPayload
) => {
  if (payload && error !== undefined) {
    console.error(buildPrefix(scope, message), payload, error)
    return
  }

  if (error !== undefined) {
    console.error(buildPrefix(scope, message), error)
    return
  }

  if (payload) {
    console.error(buildPrefix(scope, message), payload)
    return
  }

  console.error(buildPrefix(scope, message))
}

export const createDurationLogger = (scope: string, message: string, payload?: LogPayload) => {
  const startedAt = now()
  logInfo(scope, `${message}:start`, payload)

  return (result?: LogPayload) => {
    logInfo(scope, `${message}:done`, {
      durationMs: Number((now() - startedAt).toFixed(2)),
      ...result,
    })
  }
}
