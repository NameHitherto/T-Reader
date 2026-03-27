export const WINDOW_EVENTS = {
  READY_TO_RECEIVE_BOOK_KEY: 'ready-to-receive-book-key',
  LOAD_BOOK_KEY: 'load-book-key',
  SHOW_BOOK_INFO: 'show-book-info',
  SHOW_ASSISTANT: 'show-assistant',
  SHOW_HELP: 'show-help',
  UPDATE_READER_STYLE: 'update-reader-style',
} as const

export const READER_DOM_EVENTS = {
  TOGGLE_STYLE_MENU: 'reader:toggle-style-menu',
  CLOSE_STYLE_MENU: 'reader:close-style-menu',
} as const
