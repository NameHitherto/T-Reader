export const DEFAULT_READER_FONT = 'serif'
export const DEFAULT_READER_FONT_LABEL = '系统默认（Serif）'
export const SYSTEM_FONT_PREVIEW_TEXT = 'Roxy ㄙㄞˋ ㄍㄠ！'

export interface SystemFontEntry {
  family: string
  displayFamily: string
  subfamily: string | null
  fullName: string | null
  postscriptName: string | null
  weight: number | null
  path: string | null
  faceIndex: number
  familyAliases: string[]
}

export interface EnabledSystemFont {
  family: string
  displayFamily: string
  subfamily: string | null
  fullName: string | null
  postscriptName: string | null
  weight: number | null
  path: string | null
  faceIndex: number
  familyAliases?: string[]
}
