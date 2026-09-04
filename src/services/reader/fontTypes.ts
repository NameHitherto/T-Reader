export const DEFAULT_READER_FONT = 'serif'
export const DEFAULT_READER_FONT_LABEL = '系统默认（Serif）'
export const SYSTEM_FONT_PREVIEW_TEXT = 'Roxy ㄙㄞˋ ㄍㄠ！'
export const BOOK_FONT_PREFIX = 'book-font:'

export type ReaderFontType = 'default' | 'system' | 'book'

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

export interface LocalFontEntry {
  filename: string
  family: string
  displayFamily: string
  subfamily: string | null
  fullName: string | null
  postscriptName: string | null
  weight: number | null
  path: string
  faceIndex: number
  familyAliases: string[]
}

export type LocalFontExtractionStatus = 'extracted' | 'existing' | 'skipped' | 'failed'

export interface LocalFontExtractionResult {
  sourcePath: string
  filename: string | null
  fonts: LocalFontEntry[]
  status: LocalFontExtractionStatus
  reason: string | null
}

export interface LocalFontWarning {
  filename: string
  reason: string
}

export interface LocalFontsResult {
  fonts: LocalFontEntry[]
  warnings: LocalFontWarning[]
}

export interface DeleteLocalFontResult {
  deleted: boolean
}
