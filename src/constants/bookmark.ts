export interface BookmarkHighlightPreset {
  background: string
  text: string
}

// 高亮文本包裹 span 使用的 className，同时作为 epub.js CFI 解析时的 ignoreClass，
// 保证「不透明背景 + 逐套文字色」的文本包裹不会破坏书签定位。
export const BOOKMARK_HIGHLIGHT_CLASS = 'bookmark-highlight'

// 每套预设：背景色 + 与之适配的选中文本颜色（文字色均满足 WCAG AA ≥4.5:1 对比度）。
// 浅底深字（青/蓝/绿/黄/红）、深底白字（紫/靛/灰）；粉色深浅都临界，用纯黑兜底。
export const BOOKMARK_HIGHLIGHT_PRESETS: BookmarkHighlightPreset[] = [
  { background: '#00c4b6', text: '#111827' },
  { background: '#f44336', text: '#111827' },
  { background: '#e91e63', text: '#000000' },
  { background: '#9c27b0', text: '#ffffff' },
  { background: '#3f51b5', text: '#ffffff' },
  { background: '#2196f3', text: '#111827' },
  { background: '#4caf50', text: '#111827' },
  { background: '#ffeb3b', text: '#111827' },
  { background: '#6b7280', text: '#ffffff' },
]

export const BOOKMARK_COLOR_CHOICES = BOOKMARK_HIGHLIGHT_PRESETS.map(
  (preset) => preset.background,
)

export const DEFAULT_BOOKMARK_HIGHLIGHT_COLOR =
  BOOKMARK_COLOR_CHOICES[BOOKMARK_COLOR_CHOICES.length - 1]

const BOOKMARK_HIGHLIGHT_TEXT_COLOR_MAP: Record<string, string> =
  BOOKMARK_HIGHLIGHT_PRESETS.reduce(
    (map, preset) => {
      map[preset.background.toLowerCase()] = preset.text
      return map
    },
    {} as Record<string, string>,
  )

export const getBookmarkHighlightTextColor = (background?: string | null): string => {
  if (!background) {
    return '#111827'
  }
  return BOOKMARK_HIGHLIGHT_TEXT_COLOR_MAP[background.toLowerCase()] ?? '#111827'
}
