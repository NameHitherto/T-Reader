export type ReaderLightBackgroundPreset =
  | 'default'
  | 'parchment'
  | 'kraft'
  | 'xuan'
  | 'warm-amber'
  | 'eye-green'
  | 'soft-cyan'
  | 'jade-white'

export type ReaderDarkBackgroundPreset = 'default' | 'dark-night' | 'pure-black'

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
