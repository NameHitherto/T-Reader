type iconType =
  | 'bookOpen'
  | 'delete'
  | 'info'
  | 'goBack'
  | 'bookmark'
  | 'delBookMark'
  | 'comment'
type themeType = 'light' | 'dark'

export interface ContextMenuData {
  x: number
  y: number
  width: number
  theme: themeType
  items: ContextMenuItem[]
}

export interface ContextMenuItem {
  label: string
  type?: iconType
  onClick?: (e: MouseEvent | KeyboardEvent) => void
}

export interface BookConfig {
  name: string
  author: string
  durChapterIndex: number
  durChapterPos: number
  durChapterTitle: string
  durChapterTime: number
}
