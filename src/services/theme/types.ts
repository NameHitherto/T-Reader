import type { ReaderBackgroundPreset } from '@/services/theme/backgroundTypes'

export interface AppThemePalette {
  appBackground: string
  appForeground: string
  loadingOverlay: string
  readerBackground: string
  readerSurface: string
  readerSurfaceStrong: string
  readerText: string
  readerMutedText: string
  readerLink: string
  readerSelectionBackground: string
  readerSelectionColor: string
  readerImageFilter: string
}

export interface ReaderRuntimePalette {
  viewportBackground: string
  contentBackground: string
  backgroundImage?: string
  backgroundSize?: string
  backgroundPosition?: string
  surface: string
  surfaceStrong: string
  text: string
  mutedText: string
  link: string
  selectionBackground: string
  selectionColor: string
  imageFilter: string
}

export interface ReaderBackgroundPresetOption<T extends ReaderBackgroundPreset> {
  value: T
  label: string
  description: string
  preview: string
  previewBackgroundImage?: string
  previewBackgroundSize?: string
  previewBackgroundPosition?: string
}
