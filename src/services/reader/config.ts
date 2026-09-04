import { invoke } from '@tauri-apps/api/core'
import { ref } from 'vue'
import { DEFAULT_READER_FONT, type EnabledSystemFont } from '@/services/reader/fontTypes'
import { getReaderThemeCompatColors, syncReaderConfigThemeColors } from '@/services/theme'
import type { AppThemeMode } from '@/services/settings'
import { dispatchReaderStyleUpdate } from '@/services/ipc'
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
  updateConfig: updateReaderConfig,
})

export const loadReaderConfigFromDisk = async () => {
  return await invoke<Record<string, unknown>>('load_reader_config')
}

export const saveReaderConfigToDisk = async (config: object) => {
  return await invoke<ReaderConfig>('save_reader_config', { request: config })
}

let readerConfigTask: Promise<unknown> = Promise.resolve()

// 配置刷新与用户修改共用队列，防止较早的数据库读取覆盖较新的修改。
export const runReaderConfigTask = <T>(task: () => Promise<T>): Promise<T> => {
  const result = readerConfigTask.then(task)
  readerConfigTask = result.catch(() => undefined)
  return result
}

export type ReaderConfigUpdate =
  | Partial<ReaderConfig>
  | ((current: ReaderConfig) => Partial<ReaderConfig> | null)

// 所有用户样式修改都必须先写入数据库，成功后再同步内存并通知阅读窗口。
export const updateReaderConfig = (update: ReaderConfigUpdate, themeMode?: AppThemeMode) =>
  runReaderConfigTask(async () => {
    const current = {
      ...createDefaultReaderConfig(),
      ...(await loadReaderConfigFromDisk()),
    } as ReaderConfig
    const patch = typeof update === 'function' ? update(current) : update
    if (!patch) return current

    const next = syncReaderConfigThemeColors({ ...current, ...patch }, themeMode)
    const saved = await saveReaderConfigToDisk({
      ...patch,
      color: next.color,
      fontColor: next.fontColor,
    })
    readerConfig.value = saved
    await dispatchReaderStyleUpdate()
    return saved
  })
