import { computed, ref } from 'vue'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import {
  BOOK_FONT_PREFIX,
  type DeleteLocalFontResult,
  type LocalFontEntry,
  type LocalFontExtractionResult,
  type LocalFontsResult,
} from '@/services/reader/fontTypes'
import type { ReaderFontOption } from '@/services/reader/types'
import { dispatchReaderStyleUpdate } from '@/services/ipc'

interface RawLocalFontEntry {
  filename: string
  family: string
  display_family: string
  subfamily: string | null
  full_name: string | null
  postscript_name: string | null
  weight: number | null
  path: string
  face_index: number
  family_aliases: string[]
}

interface RawLocalFontExtractionResult {
  source_path: string
  filename: string | null
  fonts: RawLocalFontEntry[]
  status: LocalFontExtractionResult['status']
  reason: string | null
}

interface RawLocalFontsResult {
  fonts: RawLocalFontEntry[]
  warnings: LocalFontsResult['warnings']
}

const normalizeLocalFontEntry = (font: RawLocalFontEntry): LocalFontEntry => ({
  filename: font.filename,
  family: font.family,
  displayFamily: font.display_family,
  subfamily: font.subfamily,
  fullName: font.full_name,
  postscriptName: font.postscript_name,
  weight: font.weight,
  path: font.path,
  faceIndex: font.face_index,
  familyAliases: font.family_aliases,
})

const normalizeLocalFontExtractionResult = (
  result: RawLocalFontExtractionResult,
): LocalFontExtractionResult => ({
  sourcePath: result.source_path,
  filename: result.filename,
  fonts: result.fonts.map(normalizeLocalFontEntry),
  status: result.status,
  reason: result.reason,
})

export const extractEpubFonts = async (filename: string): Promise<LocalFontExtractionResult[]> => {
  const results = await invoke<RawLocalFontExtractionResult[]>('extract_epub_fonts', {
    filename,
  })

  return results.map(normalizeLocalFontExtractionResult)
}

export const getLocalFonts = async (): Promise<LocalFontsResult> => {
  // 只读取数据库中的已解析字体记录，阅读窗口不得回退为目录扫描。
  const result = await invoke<RawLocalFontsResult>('get_local_fonts')

  return {
    fonts: result.fonts.map(normalizeLocalFontEntry),
    warnings: result.warnings,
  }
}

// 仅供设置侧登记已有字体文件；阅读侧使用 getLocalFonts。
export const refreshLocalFontCatalog = async (): Promise<LocalFontsResult> => {
  const result = await invoke<RawLocalFontsResult>('refresh_local_font_catalog')
  await dispatchReaderStyleUpdate()

  return {
    fonts: result.fonts.map(normalizeLocalFontEntry),
    warnings: result.warnings,
  }
}

export const deleteLocalFont = async (filename: string): Promise<DeleteLocalFontResult> => {
  return await invoke<DeleteLocalFontResult>('delete_local_font', { filename })
}

export const getLocalFontUrl = (font: Pick<LocalFontEntry, 'path'>): string => {
  return convertFileSrc(font.path)
}

export const getBookFontValue = (
  font: Pick<LocalFontEntry, 'filename'> & Partial<Pick<LocalFontEntry, 'faceIndex'>>,
): string => {
  const faceIndex = font.faceIndex ?? 0

  return `${BOOK_FONT_PREFIX}${font.filename}:${faceIndex}`
}

export const isBookFontValue = (value: string | null | undefined): boolean => {
  return typeof value === 'string' && value.startsWith(BOOK_FONT_PREFIX)
}

export const parseBookFontValue = (
  value: string,
): { filename: string; faceIndex: number } | null => {
  if (!isBookFontValue(value)) {
    return null
  }
  const payload = value.slice(BOOK_FONT_PREFIX.length)
  const separatorIndex = payload.lastIndexOf(':')
  if (separatorIndex === -1) {
    return { filename: payload, faceIndex: 0 }
  }
  const filename = payload.slice(0, separatorIndex)
  const faceIndexStr = payload.slice(separatorIndex + 1)
  const faceIndex = parseInt(faceIndexStr, 10)

  return {
    filename,
    faceIndex: Number.isFinite(faceIndex) ? faceIndex : 0,
  }
}

export const formatBookFontLabel = (
  font: Pick<LocalFontEntry, 'family' | 'displayFamily' | 'subfamily' | 'fullName'>,
): string => {
  if (font.fullName) {
    return font.fullName
  }
  if (font.subfamily) {
    return `${font.displayFamily} ${font.subfamily}`
  }
  return font.displayFamily || font.family
}

// 当前通过文件 URL 加载字体，只能可靠选择集合的首个字面。
const isSupportedLocalFont = (font: LocalFontEntry) => font.faceIndex === 0

export const findLocalFontMatch = (
  fontValue: string,
  localFonts: LocalFontEntry[],
): LocalFontEntry | null => {
  const normalized = (fontValue || '').trim()
  if (!normalized) {
    return null
  }

  const parsed = parseBookFontValue(normalized)
  if (parsed) {
    return (
      localFonts.find(
        (font) =>
          isSupportedLocalFont(font) &&
          font.filename.toLowerCase() === parsed.filename.toLowerCase() &&
          font.faceIndex === parsed.faceIndex,
      ) || null
    )
  }

  const lowerValue = normalized.toLowerCase()

  return (
    // 仅兼容旧的文件名标识；字体名称属于系统字体命名空间。
    localFonts.find(
      (font) => isSupportedLocalFont(font) && font.filename.toLowerCase() === lowerValue,
    ) || null
  )
}

export const buildReaderBookFontOptions = (fonts: LocalFontEntry[]): ReaderFontOption[] => {
  return fonts.filter(isSupportedLocalFont).map((font) => ({
    label: formatBookFontLabel(font),
    value: getBookFontValue(font),
    family: font.family,
    subfamily: font.subfamily,
    isDefault: false,
    type: 'book',
    filename: font.filename,
  }))
}

const localFontsState = ref<LocalFontEntry[]>([])

export const useLocalFonts = () => ({
  localFonts: computed(() => localFontsState.value),
  setLocalFonts: (fonts: LocalFontEntry[]) => {
    localFontsState.value = fonts
  },
  refreshLocalFonts: async () => {
    try {
      const result = await getLocalFonts()
      localFontsState.value = result.fonts
      return result.fonts
    } catch {
      return localFontsState.value
    }
  },
})
