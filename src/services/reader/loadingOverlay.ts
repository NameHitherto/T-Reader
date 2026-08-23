import { ElLoading } from 'element-plus'
import { getAppThemePalette, getAppliedAppThemeMode } from '@/services/theme'

interface ReaderLoadingOptions {
  text?: string
  background?: string
  lock?: boolean
}

export const withReaderLoading = async <T>(
  task: () => Promise<T>,
  options: ReaderLoadingOptions = {},
): Promise<T> => {
  const palette = getAppThemePalette(getAppliedAppThemeMode())
  const loading = ElLoading.service({
    lock: options.lock ?? true,
    text: options.text || '正在加载书籍...',
    background: options.background || palette.loadingOverlay,
  })

  try {
    return await task()
  } finally {
    loading.close()
  }
}
