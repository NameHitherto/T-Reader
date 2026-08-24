// src/stores/readerConfigStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { EnabledSystemFont } from '@/types/readerFonts'
import { DEFAULT_READER_FONT } from '@/types/readerFonts'
import { getReaderThemeCompatColors } from '@/services/theme'
import {
  createDefaultReaderBackgroundPresets,
  type ReaderBackgroundPresets,
} from '@/types/readerBackground'

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

export const useReaderConfigStore = defineStore('readerConfig', () => {
  // 使用 ref 定义响应式状态
  const readerConfig = ref<ReaderConfig>(createDefaultReaderConfig())

  // 此处可以定义一个恢复默认设置的方法
  const setDefaultConfig = () => {
    readerConfig.value = createDefaultReaderConfig()
  }

  // 更新状态变量
  const setReaderConfig = (config: Partial<ReaderConfig>) => {
    readerConfig.value = { ...readerConfig.value, ...config }
  }

  // 定义计算方法
  const calculate = (key: keyof ReaderConfig, value: number) => {
    const currentValue = readerConfig.value[key]
    if (typeof currentValue !== 'number') {
      return
    }
    const nextValue = Number((currentValue + value).toFixed(2))
    // 保留小数位同number一样
    ;(readerConfig.value[key] as number) = nextValue
  }

  // 定义Action
  const changeState = <K extends keyof ReaderConfig>(key: K, value: ReaderConfig[K]) => {
    readerConfig.value[key] = value
  }

  return {
    readerConfig,
    setReaderConfig,
    calculate,
    changeState,
    setDefaultConfig,
  }
})
