import { invoke } from '@tauri-apps/api/core'
import { WINDOW_EVENTS } from '@/constants/events'

interface OpenReaderWindowResult {
  created: boolean
  acknowledged: boolean
  messageId: string
}

interface DispatchReaderEventResult {
  delivered: boolean
}

export interface ReaderLoadPayload {
  bookKey: string
  cfi?: string
  messageId?: string
}

export interface BookshelfProgressSavedPayload {
  bookKey: string
  progress: number
  durChapterIndex: number
  durChapterPos: number
  durChapterTitle: string
  durChapterTime: number
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

export const dispatchReaderEvent = async (
  eventName: string,
  payload?: unknown
): Promise<boolean> => {
  const result = await invoke<DispatchReaderEventResult>('dispatch_reader_event', {
    eventName,
    payload: payload ?? {},
  })

  return result.delivered
}

export const dispatchMainEvent = async (
  eventName: string,
  payload?: unknown
): Promise<boolean> => {
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

export const dispatchBookshelfProgressSaved = async (
  payload: BookshelfProgressSavedPayload
) => {
  return await dispatchMainEvent(WINDOW_EVENTS.BOOKSHELF_PROGRESS_SAVED, payload)
}
