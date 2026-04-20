import {
  buildLocalDirPath,
  CLOUD_DIRS,
  ensureLocalStorageDirs,
  LOCAL_DIRS,
  LOCAL_STORAGE_ROOT,
} from '@/services/fileSystem/localStorageService'

/**
 * 本地目录结构：
 * T-Reader/
 *   ├── books/         # 书籍文件 (epub)
 *   ├── bookProgress/  # 阅读进度配置 (json)
 *   ├── cached/        # 缓存文件
 *   └── system/        # 系统文件 (设置等)
 */

/**
 * 云端目录结构：
 * /T-Reader/
 *   ├── books/         # 书籍文件 (epub)
 *   └── bookProgress/  # 阅读进度配置 (json)
 */

/**
 * 本地目录名称（前端常量）
 */
export type LocalDirNames = typeof LOCAL_DIRS

/**
 * 云端目录名称（前端常量）
 */
export type CloudDirNames = typeof CLOUD_DIRS

/**
 * 获取本地目录名称（带缓存）
 */
export const getLocalDirNames = async (): Promise<LocalDirNames> => {
  await ensureLocalStorageDirs()
  return { ...LOCAL_DIRS }
}

/**
 * 获取云端目录名称（带缓存）
 */
export const getCloudDirNames = async (): Promise<CloudDirNames> => {
  return { ...CLOUD_DIRS }
}

/**
 * 检查并确保本地目录结构完整
 * @returns 本地根目录路径
 */
export const checkLocalDirs = async (): Promise<string> => {
  await ensureLocalStorageDirs()
  return LOCAL_STORAGE_ROOT
}

/**
 * 获取本地书籍文件路径
 */
export const getLocalBooksDir = async (): Promise<string> => {
  await ensureLocalStorageDirs()
  return buildLocalDirPath(LOCAL_DIRS.books)
}

/**
 * 获取本地进度配置文件路径
 */
export const getLocalProgressDir = async (): Promise<string> => {
  await ensureLocalStorageDirs()
  return buildLocalDirPath(LOCAL_DIRS.progress)
}

/**
 * 获取本地缓存目录路径
 */
export const getLocalCachedDir = async (): Promise<string> => {
  await ensureLocalStorageDirs()
  return buildLocalDirPath(LOCAL_DIRS.cached)
}

/**
 * 获取本地系统目录路径
 */
export const getLocalSystemDir = async (): Promise<string> => {
  await ensureLocalStorageDirs()
  return buildLocalDirPath(LOCAL_DIRS.system)
}
