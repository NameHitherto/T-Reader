export interface GalleryImage {
  id: string
  bookKey: string | null
  bookTitle: string
  prompt: string
  providerType: string
  modelId: string
  imagePath: string
  /** JSON 数组字符串，元素为相对 Documents/T-Reader 的参考图路径 */
  referencePaths: string
  imageSize: string | null
  createdAt: string
}

export interface GenerateGalleryImageRequest {
  prompt: string
  bookKey?: string | null
  bookTitle?: string | null
  referencePaths: string[]
  size?: string | null
}

export const parseGalleryReferencePaths = (referencePaths: string): string[] => {
  try {
    const parsed = JSON.parse(referencePaths)

    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}
