// 书签下划线使用的 className（SVG 覆盖层）。
export const BOOKMARK_UNDERLINE_CLASS = 'bookmark-underline'

export type UnderlineType = 'straight' | 'dashed' | 'dotted' | 'wavy'

export interface UnderlineStyle {
  color: string
  type: UnderlineType
  width: number
}

export const UNDERLINE_TYPES: UnderlineType[] = ['straight', 'dashed', 'dotted', 'wavy']

export const UNDERLINE_COLOR_CHOICES = [
  '#00c4b6',
  '#f44336',
  '#e91e63',
  '#9c27b0',
  '#3f51b5',
  '#2196f3',
  '#4caf50',
  '#ffeb3b',
  '#6b7280',
] as const

export const UNDERLINE_WIDTH_CHOICES = [1, 2, 3] as const

export const DEFAULT_UNDERLINE_STYLE: UnderlineStyle = {
  color: UNDERLINE_COLOR_CHOICES[UNDERLINE_COLOR_CHOICES.length - 1],
  type: 'straight',
  width: 2,
}
