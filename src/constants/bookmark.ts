// 书签高亮使用的 className（SVG 覆盖层）。
export const BOOKMARK_HIGHLIGHT_CLASS = 'bookmark-highlight'

export const BOOKMARK_COLOR_CHOICES = [
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

export const DEFAULT_BOOKMARK_HIGHLIGHT_COLOR =
  BOOKMARK_COLOR_CHOICES[BOOKMARK_COLOR_CHOICES.length - 1]
