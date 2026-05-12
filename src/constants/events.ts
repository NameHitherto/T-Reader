export const WINDOW_EVENTS = {
  LOAD_BOOK_KEY: 'load-book-key',
  BOOKSHELF_PROGRESS_SAVED: 'bookshelf-progress-saved',
  SHOW_BOOK_INFO: 'show-book-info',
  SHOW_ASSISTANT: 'show-assistant',
  SHOW_HELP: 'show-help',
  UPDATE_APP_THEME: 'update-app-theme',
  UPDATE_READER_STYLE: 'update-reader-style',
  READER_WINDOW_HIDE: 'reader-window-hide',
  CLOUD_SYNC_FAILED: 'cloud-sync-failed',
} as const

export const READER_DOM_EVENTS = {
  TOGGLE_STYLE_MENU: 'reader:toggle-style-menu',
  CLOSE_STYLE_MENU: 'reader:close-style-menu',
} as const
