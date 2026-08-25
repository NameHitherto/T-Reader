import { invoke } from '@tauri-apps/api/core'
import { GalleryImage, GenerateGalleryImageRequest } from '@/services/gallery/types'
import { ensureLocalDir, writeBinaryFile, buildLocalFilePath } from '@/services/fs'
import { generateID } from '@/utils/id'
import { join } from '@/utils/path'

const GALLERY_STAGING_SUBDIR = 'cached/gallery/_staging'

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const listGalleryImages = async (bookKey?: string | null): Promise<GalleryImage[]> => {
  return await invoke<GalleryImage[]>('list_gallery_images', { bookKey: bookKey ?? null })
}

export const deleteGalleryImage = async (id: string): Promise<void> => {
  await invoke('delete_gallery_image', { id })
}

export const generateGalleryImage = async (
  request: GenerateGalleryImageRequest,
): Promise<GalleryImage> => {
  return await invoke<GalleryImage>('generate_gallery_image', { request })
}

/**
 * 把参考图字节写入画廊暂存目录，返回相对 Documents/T-Reader 的路径
 * （与后端 gallery 记录的路径口径一致）。
 * 生成命令会把暂存文件移动到对应图片目录并清理。
 */
export const stageReferenceImage = async (bytes: Uint8Array, mimeType: string): Promise<string> => {
  const extension = EXTENSION_BY_MIME[mimeType] ?? 'png'
  const filename = `${generateID(8)}.${extension}`

  await ensureLocalDir(GALLERY_STAGING_SUBDIR)
  await writeBinaryFile(buildLocalFilePath(GALLERY_STAGING_SUBDIR, filename), bytes)

  return join(GALLERY_STAGING_SUBDIR, filename)
}
