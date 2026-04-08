import { ParsedBookMeta } from '@/services/book/types'
import { getFileNameWithoutExtension } from '@/utils/filePath'
import { createDurationLogger } from '@/utils/logger'

export const parseTxtMeta = (path: string): ParsedBookMeta => {
  const finishLog = createDurationLogger('txt-parser', 'parse-txt-meta', {
    path,
  })
  const payload = {
    format: 'txt' as const,
    title: getFileNameWithoutExtension(path),
    author: '未知作者',
    cover: '',
  }
  finishLog({
    path,
    title: payload.title,
  })
  return payload
}
