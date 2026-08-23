import { invoke } from '@tauri-apps/api/core'
import { WINDOW_EVENTS } from '@/constants/events'
import type {
  BookshelfProgressSavedPayload,
  PrepareReaderBookDeleteResult,
} from './types'

interface OpenReaderWindowResult {
  created: boolean
  acknowledged: boolean
  messageId: string
}

interface DispatchReaderEventResult {
  delivered: boolean
}

export const openReaderWindow = async (bookKey: string, cfi = '') => {
  return await invoke<OpenReaderWindowResult>('open_reader_window', {
    bookKey,
    cfi,
  })
}

export const notifyReaderWindowReady = async () => {
  await invoke('reader_window_ready')
}

export const ackReaderLoadMessage = async (messageId: string) => {
  await invoke('ack_reader_load', {
    messageId,
  })
}

export const prepareReaderBookDelete = async (bookKey: string) => {
  return await invoke<PrepareReaderBookDeleteResult>('prepare_reader_book_delete', {
    bookKey,
  })
}

export const ackReaderBookDelete = async (messageId: string, affected: boolean) => {
  await invoke('ack_reader_book_delete', {
    messageId,
    affected,
  })
}

export const hideReaderWindow = async () => {
  await invoke('hide_reader_window')
}

export const dispatchReaderEvent = async (
  eventName: string,
  payload?: unknown,
): Promise<boolean> => {
  const result = await invoke<DispatchReaderEventResult>('dispatch_reader_event', {
    eventName,
    payload: payload ?? {},
  })

  return result.delivered
}

export const dispatchMainEvent = async (eventName: string, payload?: unknown): Promise<boolean> => {
  const result = await invoke<DispatchReaderEventResult>('dispatch_main_event', {
    eventName,
    payload: payload ?? {},
  })

  return result.delivered
}

export const dispatchReaderStyleUpdate = async () => {
  return await dispatchReaderEvent(WINDOW_EVENTS.UPDATE_READER_STYLE)
}

export const dispatchReaderThemeUpdate = async (mode: string) => {
  return await dispatchReaderEvent(WINDOW_EVENTS.UPDATE_APP_THEME, { mode })
}

export const dispatchBookshelfProgressSaved = async (payload: BookshelfProgressSavedPayload) => {
  return await dispatchMainEvent(WINDOW_EVENTS.BOOKSHELF_PROGRESS_SAVED, payload)
}
