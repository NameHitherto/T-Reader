import { ParsedBookMeta } from '@/services/book/types'
import { getFileNameWithoutExtension } from '@/js/bookFormat'

export const parseTxtMeta = (path: string): ParsedBookMeta => {
  return {
    format: 'txt',
    title: getFileNameWithoutExtension(path),
    author: '未知作者',
    language: '未知',
    cover: '',
  }
}
