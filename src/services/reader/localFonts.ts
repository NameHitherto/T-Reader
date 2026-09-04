import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import type {
  DeleteLocalFontResult,
  LocalFontEntry,
  LocalFontExtractionResult,
  LocalFontsResult,
} from '@/services/reader/fontTypes'

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
  const result = await invoke<RawLocalFontsResult>('get_local_fonts')

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
