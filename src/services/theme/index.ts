export { applyAppThemeMode, emitAppThemeUpdate, initializeAppTheme } from './apply'
export {
  buildReaderBackgroundDeclarations,
  getActiveReaderBackgroundPreset,
  getAppThemePalette,
  getAppliedAppThemeMode,
  getReaderBackgroundPresetOptions,
  getReaderRuntimePalette,
  getReaderThemeCompatColors,
  normalizeReaderBackgroundPresets,
  syncReaderConfigThemeColors,
} from './palettes'

export type { AppThemePalette, ReaderBackgroundPresetOption, ReaderRuntimePalette } from './types'
