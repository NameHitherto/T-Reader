import { invoke } from '@tauri-apps/api/core'
import { ref } from 'vue'
import { DEFAULT_READER_FONT, type EnabledSystemFont } from '@/services/reader/fontTypes'
import { getReaderThemeCompatColors } from '@/services/theme'
import {
  createDefaultReaderBackgroundPresets,
  type ReaderBackgroundPresets,
} from '@/services/theme/backgroundTypes'

export type EpubBuiltInStylesheetMode = 'removed' | 'filtered' | 'preserved'

export type ReaderFlowMode =
  | 'auto'
  | 'paginated'
  | 'scrolled'
  | 'scrolled-doc'
  | 'scrolled-continuous'

export interface ReaderConfig {
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
  font: string
  color: string
  fontColor: string
  backgroundPresets: ReaderBackgroundPresets
  flow: ReaderFlowMode
  enabledSystemFonts: EnabledSystemFont[]
  epubBuiltInStylesheetMode: EpubBuiltInStylesheetMode
}

export const createDefaultReaderConfig = (): ReaderConfig => {
  const backgroundPresets = createDefaultReaderBackgroundPresets()

  return {
    ...getReaderThemeCompatColors(backgroundPresets),
    fontSize: 16,
    fontWeight: 400,
    lineSpacing: 1.3,
    paragraphSpacing: 0.2,
    letterSpacing: 0,
    boxPaddingTop: 20,
    boxPaddingBottom: 20,
    boxPaddingHorizontal: 20,
    columnCount: 2,
    indent: 2,
    font: DEFAULT_READER_FONT,
    backgroundPresets,
    flow: 'paginated',
    enabledSystemFonts: [],
    epubBuiltInStylesheetMode: 'filtered',
  }
}

const readerConfig = ref<ReaderConfig>(createDefaultReaderConfig())

export const useReaderConfig = () => ({
  readerConfig,
  setDefaultConfig: () => {
    readerConfig.value = createDefaultReaderConfig()
  },
  setReaderConfig: (config: Partial<ReaderConfig>) => {
    readerConfig.value = { ...readerConfig.value, ...config }
  },
  calculate: (key: keyof ReaderConfig, value: number) => {
    const currentValue = readerConfig.value[key]
    if (typeof currentValue !== 'number') return
    ;(readerConfig.value[key] as number) = Number((currentValue + value).toFixed(2))
  },
  changeState: <K extends keyof ReaderConfig>(key: K, value: ReaderConfig[K]) => {
    readerConfig.value[key] = value
  },
})

export const loadReaderConfigFromDisk = async () => {
  return await invoke<Record<string, unknown>>('load_reader_config')
}

export const saveReaderConfigToDisk = async (config: object) => {
  await invoke('save_reader_config', { request: config })
}
