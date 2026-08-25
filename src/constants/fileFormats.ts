/**
 * 系统支持的书籍格式与扩展名
 */
export const SUPPORTED_BOOK_FORMATS = ['epub'] as const

export const SUPPORTED_BOOK_EXTENSIONS = ['epub'] as const

/**
 * 系统支持导入的书籍格式
 */
export const SUPPORTED_IMPORT_BOOK_FORMATS = ['epub', 'txt'] as const

/**
 * 系统支持的图片扩展名（封面、画廊参考图等）
 */
export const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const

/**
 * 封面文件最大体积限制（5MB）
 */
export const MAX_COVER_IMAGE_BYTES = 5 * 1024 * 1024
