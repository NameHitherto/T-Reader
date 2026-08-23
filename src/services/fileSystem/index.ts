import { BaseDirectory } from '@tauri-apps/api/path'
import {
  exists,
  mkdir,
  readDir,
  readFile,
  remove,
  type DirEntry,
  writeFile,
} from '@tauri-apps/plugin-fs'
import { encodeJson } from '@/utils/json'

export const LOCAL_STORAGE_ROOT = 'T-Reader'

export const LOCAL_DIRS = {
  books: 'books',
  progress: 'bookProgress',
  cached: 'cached',
  system: 'system',
} as const

export const CLOUD_DIRS = {
  books: 'books',
  progress: 'bookProgress',
} as const

let ensureLocalStoragePromise: Promise<void> | null = null

const DOCUMENT_OPTIONS = {
  baseDir: BaseDirectory.Document,
} as const

export const buildLocalDirPath = (subdir: string): string => {
  return `${LOCAL_STORAGE_ROOT}/${subdir}`
}

export const buildLocalFilePath = (subdir: string, filename: string): string => {
  return `${buildLocalDirPath(subdir)}/${filename}`
}

export const ensureLocalStorageDirs = async (): Promise<void> => {
  if (!ensureLocalStoragePromise) {
    ensureLocalStoragePromise = (async () => {
      await mkdir(LOCAL_STORAGE_ROOT, {
        ...DOCUMENT_OPTIONS,
        recursive: true,
      })

      await Promise.all(
        Object.values(LOCAL_DIRS).map((subdir) =>
          mkdir(buildLocalDirPath(subdir), {
            ...DOCUMENT_OPTIONS,
            recursive: true,
          }),
        ),
      )
    })()
  }

  await ensureLocalStoragePromise
}

export const localPathExists = async (relativePath: string): Promise<boolean> => {
  return await exists(relativePath, DOCUMENT_OPTIONS)
}

export const readBinaryFile = async (relativePath: string): Promise<Uint8Array> => {
  await ensureLocalStorageDirs()
  const payload = await readFile(relativePath, DOCUMENT_OPTIONS)

  return payload instanceof Uint8Array ? payload : new Uint8Array(payload)
}

export const writeBinaryFile = async (
  relativePath: string,
  data: Uint8Array | number[],
): Promise<void> => {
  await ensureLocalStorageDirs()
  const payload = data instanceof Uint8Array ? data : Uint8Array.from(data)
  await writeFile(relativePath, payload, DOCUMENT_OPTIONS)
}

export const readJsonFile = async <T>(relativePath: string): Promise<T> => {
  const payload = await readBinaryFile(relativePath)

  return JSON.parse(new TextDecoder().decode(payload)) as T
}

export const writeJsonFile = async (relativePath: string, value: unknown): Promise<void> => {
  await writeBinaryFile(relativePath, encodeJson(value))
}

export const ensureLocalDir = async (relativeSubdir: string): Promise<void> => {
  await mkdir(buildLocalDirPath(relativeSubdir), {
    ...DOCUMENT_OPTIONS,
    recursive: true,
  })
}

export const removeLocalFile = async (relativePath: string): Promise<void> => {
  if (!(await localPathExists(relativePath))) {
    return
  }

  await remove(relativePath, DOCUMENT_OPTIONS)
}

export const removeLocalDir = async (relativeSubdir: string): Promise<void> => {
  const relativePath = buildLocalDirPath(relativeSubdir)

  if (!(await localPathExists(relativePath))) {
    return
  }

  await remove(relativePath, {
    ...DOCUMENT_OPTIONS,
    recursive: true,
  })
}

export const readLocalDirEntries = async (relativePath: string): Promise<DirEntry[]> => {
  await ensureLocalStorageDirs()
  return await readDir(relativePath, DOCUMENT_OPTIONS)
}

/**
 * 本地目录结构：
 * T-Reader/
 *   ├── books/         # 书籍文件 (epub)
 *   ├── bookProgress/  # 阅读进度配置 (json)
 *   ├── cached/        # 缓存文件
 *   └── system/        # 系统文件 (设置等)
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
