import { invoke } from '@tauri-apps/api/core'

/**
 * 本地目录结构：
 * T-Reader/
 *   ├── books/         # 书籍文件 (epub/txt)
 *   ├── bookProgress/  # 阅读进度配置 (json)
 *   ├── cached/        # 缓存文件
 *   └── system/        # 系统文件 (设置等)
 */

/**
 * 云端目录结构：
 * /T-Reader/
 *   ├── books/         # 书籍文件 (epub/txt)
 *   └── bookProgress/  # 阅读进度配置 (json)
 */

/**
 * 本地目录名称（从后端获取）
 */
export interface LocalDirNames {
  books: string
  progress: string
  cached: string
  system: string
}

/**
 * 云端目录名称（从后端获取）
 */
export interface CloudDirNames {
  books: string
  progress: string
}

/**
 * 缓存的目录名称
 */
let cachedLocalDirs: LocalDirNames | null = null
let cachedCloudDirs: CloudDirNames | null = null

/**
 * 获取本地目录名称（带缓存）
 */
export const getLocalDirNames = async (): Promise<LocalDirNames> => {
  if (cachedLocalDirs) {
    return cachedLocalDirs
  }
  cachedLocalDirs = await invoke<LocalDirNames>('get_local_dir_names_command')
  return cachedLocalDirs
}

/**
 * 获取云端目录名称（带缓存）
 */
export const getCloudDirNames = async (): Promise<CloudDirNames> => {
  if (cachedCloudDirs) {
    return cachedCloudDirs
  }
  cachedCloudDirs = await invoke<CloudDirNames>('get_cloud_dir_names_command')
  return cachedCloudDirs
}

/**
 * 检查并确保本地目录结构完整
 * @returns 本地根目录路径
 */
export const checkLocalDirs = async (): Promise<string> => {
  return await invoke<string>('check_local_dirs_command')
}

/**
 * 检查并确保云端目录结构完整
 */
export const checkCloudDirs = async (): Promise<void> => {
  return await invoke('check_cloud_dirs_command')
}

/**
 * 获取本地书籍文件路径
 */
export const getLocalBooksDir = async (): Promise<string> => {
  const root = await checkLocalDirs()
  const dirs = await getLocalDirNames()
  return `${root}/${dirs.books}`
}

/**
 * 获取本地进度配置文件路径
 */
export const getLocalProgressDir = async (): Promise<string> => {
  const root = await checkLocalDirs()
  const dirs = await getLocalDirNames()
  return `${root}/${dirs.progress}`
}

/**
 * 获取本地缓存目录路径
 */
export const getLocalCachedDir = async (): Promise<string> => {
  const root = await checkLocalDirs()
  const dirs = await getLocalDirNames()
  return `${root}/${dirs.cached}`
}

/**
 * 获取本地系统目录路径
 */
export const getLocalSystemDir = async (): Promise<string> => {
  const root = await checkLocalDirs()
  const dirs = await getLocalDirNames()
  return `${root}/${dirs.system}`
}
