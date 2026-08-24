import type { BookConfig, BookFormat } from '@/services/book/types'
import type { ReaderBackgroundPresets } from '@/services/theme/backgroundTypes'
import type { EnabledSystemFont, SystemFontEntry } from '@/services/reader/fontTypes'
import type { BookLocationsCachePayload } from '@/services/book/types'

export interface ReaderLoadResult {
  format: BookFormat
  bookConfig: BookConfig
  bookLocationsCache: BookLocationsCachePayload | null
  fileName: string
  bookData: Uint8Array
  bookArrayBuffer?: ArrayBuffer
}

export interface ReaderStyleConfig {
  font: string
  fontSize: number
  fontWeight: number
  lineSpacing: number
  paragraphSpacing: number
  letterSpacing: number
  boxPaddingTop: number
  boxPaddingBottom: number
  boxPaddingHorizontal: number
  columnCount: number
  indent: number
  color: string
  fontColor: string
  backgroundPresets: ReaderBackgroundPresets
  flow: string
  enabledSystemFonts: EnabledSystemFont[]
}

export interface ReaderRenditionLike {
  flow: (flowMode: string) => void
  layout: (layout: unknown) => void
}

export interface ReaderFontOption {
  label: string
  value: string
  family: string
  subfamily: string | null
  isDefault: boolean
}

export interface SystemFontFamilyGroup {
  family: string
  displayFamily: string
  entries: SystemFontEntry[]
}
