import { BookMark } from '../store/bookMark'

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
  id: string
  title: string
  author: string
  location?: string
  updatedAt?: string
  bookMarks?: BookMark[]
}
