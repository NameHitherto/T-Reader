import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { WINDOW_EVENTS } from '@/constants/events'

interface RegisterReaderWindowEventsArgs {
  onLoadBookKey: (event: any) => Promise<void> | void
  onShowBookInfo: () => void
  onShowAssistant: () => void
  onShowHelp: () => void
  onUpdateReaderStyle: () => Promise<void> | void
  onCloseRequested: () => Promise<void>
}

interface ReaderWindowEventUnlisteners {
  unlistenBook: UnlistenFn
  unlistenStyle: UnlistenFn
  unlistenClose: UnlistenFn
  unlistenShowBookInfo: UnlistenFn
  unlistenShowAssistant: UnlistenFn
  unlistenShowHelp: UnlistenFn
}

export const registerReaderWindowEvents = async (
  args: RegisterReaderWindowEventsArgs
): Promise<ReaderWindowEventUnlisteners> => {
  const unlistenBook = await listen<any>(WINDOW_EVENTS.LOAD_BOOK_KEY, args.onLoadBookKey)
  const unlistenShowBookInfo = await listen(
    WINDOW_EVENTS.SHOW_BOOK_INFO,
    args.onShowBookInfo
  )
  const unlistenShowAssistant = await listen(
    WINDOW_EVENTS.SHOW_ASSISTANT,
    args.onShowAssistant
  )
  const unlistenShowHelp = await listen(WINDOW_EVENTS.SHOW_HELP, args.onShowHelp)
  const unlistenStyle = await listen(
    WINDOW_EVENTS.UPDATE_READER_STYLE,
    args.onUpdateReaderStyle
  )

  const unlistenClose = await getCurrentWindow().onCloseRequested(async () => {
    await args.onCloseRequested()
  })

  return {
    unlistenBook,
    unlistenStyle,
    unlistenClose,
    unlistenShowBookInfo,
    unlistenShowAssistant,
    unlistenShowHelp,
  }
}
