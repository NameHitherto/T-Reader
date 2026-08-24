import { convertFileSrc } from '@tauri-apps/api/core'
import { documentDir, join } from '@tauri-apps/api/path'
import { LOCAL_STORAGE_ROOT } from '@/services/fs'

/**
 * 把 gallery 记录中的相对路径（相对 Documents/T-Reader，如 cached/gallery/<id>/image.png）
 * 转换为可直接用于 <img> 的 asset 协议地址。
 */
export const buildGalleryAssetUrl = async (relativePath: string): Promise<string> => {
  const absolutePath = await join(await documentDir(), LOCAL_STORAGE_ROOT, relativePath)

  return convertFileSrc(absolutePath)
}
