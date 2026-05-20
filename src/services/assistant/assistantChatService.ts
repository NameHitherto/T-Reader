import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { AssistantStreamEvent, StartAssistantStreamOptions } from '@/types/assistant'

export interface AssistantStreamController {
  start: () => Promise<void>
  stop: () => Promise<void>
  dispose: () => Promise<void>
}

export const createAssistantRequestId = (): string => {
  return `assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return '发生未知错误'
}

export const createAssistantStream = (
  options: StartAssistantStreamOptions,
): AssistantStreamController => {
  let unlisten: UnlistenFn | null = null
  let disposed = false

  const cleanup = async () => {
    if (!unlisten) {
      return
    }

    unlisten()
    unlisten = null
  }

  const start = async () => {
    await cleanup()
    disposed = false

    unlisten = await listen<AssistantStreamEvent>('assistant-stream-event', (event) => {
      const payload = event.payload
      if (disposed || payload.requestId !== options.requestId) {
        return
      }

      if (payload.event === 'delta') {
        options.onDelta(payload.payload?.text || '')
        return
      }

      if (payload.event === 'done') {
        options.onDone()
        void cleanup()
        return
      }

      if (payload.event === 'error') {
        options.onError(payload.payload?.message || '对话请求失败')
        void cleanup()
        return
      }

      if (payload.event === 'cancelled') {
        options.onCancelled()
        void cleanup()
      }
    })

    try {
      await invoke('start_stream', {
        requestId: options.requestId,
        systemPrompt: options.systemPrompt,
        messages: JSON.stringify(options.messages),
      })
    } catch (error) {
      await cleanup()
      options.onError(toErrorMessage(error))
    }
  }

  const stop = async () => {
    await invoke('stop_stream', {
      requestId: options.requestId,
    }).catch(() => undefined)
  }

  const dispose = async () => {
    disposed = true
    await stop()
    await cleanup()
  }

  return {
    start,
    stop,
    dispose,
  }
}
