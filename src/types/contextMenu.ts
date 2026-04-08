type ContextMenuIconType =
  | 'bookOpen'
  | 'upload'
  | 'delete'
  | 'info'
  | 'goBack'
  | 'bookmark'
  | 'delBookMark'
  | 'comment'

type ContextMenuThemeType = 'light' | 'dark'

export interface ContextMenuData {
  x: number
  y: number
  width: number
  theme: ContextMenuThemeType
  items: ContextMenuItem[]
}

export interface ContextMenuItem {
  label: string
  type?: ContextMenuIconType
  onClick?: (e: MouseEvent | KeyboardEvent) => void
}
