export const DEFAULT_READER_FONT = 'serif'
export const DEFAULT_READER_FONT_LABEL = '系统默认（Serif）'
export const SYSTEM_FONT_PREVIEW_TEXT = 'Roxy ㄙㄞˋ ㄍㄠ！'

export interface SystemFontEntry {
  family: string
  postscriptName: string | null
  style: string | null
  weight: number | null
  path: string | null
}

export interface EnabledSystemFont {
  family: string
  postscriptName: string | null
  style: string | null
  weight: number | null
}
