export type BookFormat = 'epub' | 'txt'

const SUPPORTED_FORMATS: BookFormat[] = ['epub', 'txt']

export const detectBookFormatFromPath = (path: string): BookFormat | null => {
  const ext = path.split('.').pop()?.toLowerCase()
  if (!ext) {
    return null
  }

  if (SUPPORTED_FORMATS.includes(ext as BookFormat)) {
    return ext as BookFormat
  }

  return null
}

export const getBookFilename = (id: string, format: BookFormat): string => `${id}.${format}`

export const toJsonFilename = (id: string): string => `${id}.json`

export const getBookFormatDisplayName = (format: BookFormat): string => {
  if (format === 'txt') {
    return 'TXT'
  }

  return 'EPUB'
}

export const getFileNameWithoutExtension = (path: string): string => {
  const normalized = path.replace(/\\/g, '/')
  const fileName = normalized.substring(normalized.lastIndexOf('/') + 1)
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}
