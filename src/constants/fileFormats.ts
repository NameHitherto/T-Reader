import type { DialogFilter } from '@tauri-apps/plugin-dialog'

export type { DialogFilter }

/**
 * 系统支持的书籍格式与扩展名
 */
export const SUPPORTED_BOOK_FORMATS = ['epub'] as const
export type SupportedBookFormat = (typeof SUPPORTED_BOOK_FORMATS)[number]

export const SUPPORTED_BOOK_EXTENSIONS = ['epub'] as const

/**
 * 系统支持的图片扩展名（封面、画廊参考图等）
 */
export const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const

/**
 * 封面文件最大体积限制（5MB）
 */
export const MAX_COVER_IMAGE_BYTES = 5 * 1024 * 1024

/**
 * 文件选择对话框通用过滤器定义
 */
export const BOOK_FILE_DIALOG_FILTERS: DialogFilter[] = [
  {
    name: '书籍文件',
    extensions: [...SUPPORTED_BOOK_EXTENSIONS],
  },
]

export const IMAGE_FILE_DIALOG_FILTERS: DialogFilter[] = [
  {
    name: '图片',
    extensions: [...SUPPORTED_IMAGE_EXTENSIONS],
  },
]
