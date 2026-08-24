type ContextMenuIconType =
  | 'bookOpen'
  | 'upload'
  | 'delete'
  | 'info'
  | 'edit'
  | 'goBack'
  | 'bookmark'
  | 'delBookMark'
  | 'comment'
  | 'draw'

type ContextMenuThemeType = 'light' | 'dark'

export interface ContextMenuAnchor {
  x: number
  y: number
}

export interface ContextMenuData {
  anchor: ContextMenuAnchor
  theme: ContextMenuThemeType
  items: ContextMenuItem[]
  /** 与视口边缘的最小安全距离（px），默认 20 */
  margin?: number
}

export interface ContextMenuItem {
  label: string
  type?: ContextMenuIconType
  onClick?: (e: MouseEvent | KeyboardEvent) => void
}
