import { ElLoading } from 'element-plus'
import 'element-plus/es/components/loading/style/css'

interface ReaderLoadingOptions {
  text?: string
  background?: string
  lock?: boolean
}

export const withReaderLoading = async <T>(
  task: () => Promise<T>,
  options: ReaderLoadingOptions = {}
): Promise<T> => {
  const loading = ElLoading.service({
    lock: options.lock ?? true,
    text: options.text || '正在加载书籍...',
    background: options.background || 'rgba(0, 0, 0, 0.7)',
  })

  try {
    return await task()
  } finally {
    loading.close()
  }
}
