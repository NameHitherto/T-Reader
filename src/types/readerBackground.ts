export type ReaderLightBackgroundPreset = 'default' | 'warm-yellow'

export type ReaderDarkBackgroundPreset = 'default' | 'ide-dark'

export type ReaderBackgroundPreset = ReaderLightBackgroundPreset | ReaderDarkBackgroundPreset

export interface ReaderBackgroundPresets {
  light: ReaderLightBackgroundPreset
  dark: ReaderDarkBackgroundPreset
}

export const DEFAULT_READER_BACKGROUND_PRESETS: ReaderBackgroundPresets = {
  light: 'default',
  dark: 'default',
}

export const createDefaultReaderBackgroundPresets = (): ReaderBackgroundPresets => ({
  ...DEFAULT_READER_BACKGROUND_PRESETS,
})
