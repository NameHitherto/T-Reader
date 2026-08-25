/**
 * 路径组件分解结果
 */
export interface PathParts {
  /** 父目录路径（无末尾斜杠） */
  dir: string
  /** 完整文件名（含扩展名，如 'book.epub'） */
  name: string
  /** 主文件名（不含扩展名，如 'book'） */
  stem: string
  /** 扩展名（包含前导点，如 '.epub'；若无扩展名则为空字符串） */
  ext: string
}

/**
 * 标准化路径字符串：
 * 1. 统一反斜杠 `\` 为正斜杠 `/`
 * 2. 合并多余的连续斜杠 `//+` 为单个 `/`
 * 3. 去除末尾多余斜杠（根路径除外）
 *
 * @param path 待标准化的路径
 * @returns 标准化后的路径
 *
 * @example
 * normalize('C:\\Users\\Reader\\\\books/') // 'C:/Users/Reader/books'
 */
export const normalize = (path: string): string => {
  if (!path) return ''

  let normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/')

  // 去除末尾斜杠（如果不是单个根目录 `/`）
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }

  return normalized
}

/**
 * 获取路径的基础文件名（最后一部分），可选剔除指定后缀
 *
 * @param path 目标文件或目录路径
 * @param ext 可选，如果以该后缀结尾则将其截断
 * @returns 基础文件名
 *
 * @example
 * basename('C:/books/novel.epub') // 'novel.epub'
 * basename('C:/books/novel.epub', '.epub') // 'novel'
 */
export const basename = (path: string, ext?: string): string => {
  if (!path) return ''

  const normalized = normalize(path)
  const lastSlashIndex = normalized.lastIndexOf('/')
  const fileName = lastSlashIndex >= 0 ? normalized.slice(lastSlashIndex + 1) : normalized

  if (ext && fileName.endsWith(ext)) {
    return fileName.slice(0, fileName.length - ext.length)
  }

  return fileName
}

/**
 * 获取文件或目录所在的父目录路径
 *
 * @param path 目标路径
 * @returns 父目录路径，无父目录时返回空字符串
 *
 * @example
 * dirname('C:/books/sub/novel.epub') // 'C:/books/sub'
 * dirname('novel.epub') // ''
 */
export const dirname = (path: string): string => {
  if (!path) return ''

  const normalized = normalize(path)
  const lastSlashIndex = normalized.lastIndexOf('/')

  if (lastSlashIndex === -1) {
    return ''
  }

  if (lastSlashIndex === 0) {
    return '/'
  }

  return normalized.slice(0, lastSlashIndex)
}

/**
 * 获取文件的扩展名（包含前导点 `.`）
 * 符合 Node.js path.extname 标准规范
 *
 * @param path 目标路径
 * @returns 扩展名（如 `.epub`），无扩展名或隐藏文件时返回空字符串 `''`
 *
 * @example
 * extname('novel.epub') // '.epub'
 * extname('archive.tar.gz') // '.gz'
 * extname('Dockerfile') // ''
 * extname('.gitignore') // ''
 */
export const extname = (path: string): string => {
  if (!path) return ''

  const base = basename(path)
  const lastDotIndex = base.lastIndexOf('.')

  // 无点，或者点在首位（如 .gitignore），或者点在末位
  if (lastDotIndex <= 0 || lastDotIndex === base.length - 1) {
    return ''
  }

  return base.slice(lastDotIndex)
}

/**
 * 便捷函数：获取纯文件扩展名（**不含前导点**）
 *
 * @param path 目标路径
 * @returns 纯扩展名（如 `epub`），无扩展名时返回空字符串 `''`
 *
 * @example
 * getExt('novel.epub') // 'epub'
 * getExt('file.TXT') // 'TXT'
 */
export const getExt = (path: string): string => {
  const ext = extname(path)

  return ext.startsWith('.') ? ext.slice(1) : ''
}

/**
 * 获取主文件名（剔除所有目录路径和最终扩展名）
 *
 * @param path 目标路径
 * @returns 主文件名
 *
 * @example
 * getStem('C:/books/novel.2024.epub') // 'novel.2024'
 * getStem('README') // 'README'
 */
export const getStem = (path: string): string => {
  const base = basename(path)
  const lastDotIndex = base.lastIndexOf('.')

  if (lastDotIndex <= 0) {
    return base
  }

  return base.slice(0, lastDotIndex)
}

/**
 * 安全拼接多个路径片段并标准化
 * 自动忽略 undefined / null / 空字符串片段
 *
 * @param segments 路径片段列表
 * @returns 拼接并标准化后的路径
 *
 * @example
 * join('cached', 'gallery', '_staging', 'image.png') // 'cached/gallery/_staging/image.png'
 * join('T-Reader/', '/books/', 'book.epub') // 'T-Reader/books/book.epub'
 */
export const join = (...segments: (string | undefined | null)[]): string => {
  const validSegments = segments
    .filter((seg): seg is string => typeof seg === 'string' && seg.trim().length > 0)
    .map((seg) => seg.replace(/\\/g, '/'))

  if (validSegments.length === 0) {
    return ''
  }

  const rawJoin = validSegments.join('/')

  return normalize(rawJoin)
}

/**
 * 替换或追加文件的扩展名
 *
 * @param path 目标路径
 * @param newExt 新扩展名（可以带点或不带点，如 '.epub' 或 'epub'）
 * @returns 替换扩展名后的完整路径
 *
 * @example
 * changeExt('book.txt', '.epub') // 'book.epub'
 * changeExt('dir/book.txt', 'epub') // 'dir/book.epub'
 * changeExt('dir/book', 'epub') // 'dir/book.epub'
 */
export const changeExt = (path: string, newExt: string): string => {
  if (!path) return ''

  const dir = dirname(path)
  const stem = getStem(path)
  const formattedExt = newExt ? (newExt.startsWith('.') ? newExt : `.${newExt}`) : ''
  const newFileName = `${stem}${formattedExt}`

  return dir ? `${dir}/${newFileName}` : newFileName
}

/**
 * 结构化解析路径，分解为目录、全名、主名、扩展名
 *
 * @param path 目标路径
 * @returns 路径分解对象
 *
 * @example
 * splitPath('C:/books/novel.epub')
 * // { dir: 'C:/books', name: 'novel.epub', stem: 'novel', ext: '.epub' }
 */
export const splitPath = (path: string): PathParts => {
  const dir = dirname(path)
  const name = basename(path)
  const stem = getStem(path)
  const ext = extname(path)

  return { dir, name, stem, ext }
}
