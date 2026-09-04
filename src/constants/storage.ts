/**
 * 本地数据根目录（相对于系统 Documents 目录）
 */
export const LOCAL_STORAGE_ROOT = 'T-Reader'

/**
 * 本地持久化子目录
 */
export const LOCAL_DIRS = {
  books: 'books',
  progress: 'bookProgress',
  cached: 'cached',
  system: 'system',
  fonts: 'fonts',
} as const

/**
 * 云端同步子目录
 */
export const CLOUD_DIRS = {
  books: 'books',
  progress: 'bookProgress',
} as const

export type LocalDirNames = typeof LOCAL_DIRS
export type CloudDirNames = typeof CLOUD_DIRS
