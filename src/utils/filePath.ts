export const getFileNameWithoutExtension = (path: string): string => {
  const normalized = path.replace(/\\/g, '/')
  const fileName = normalized.substring(normalized.lastIndexOf('/') + 1)
  const dot = fileName.lastIndexOf('.')

  return dot > 0 ? fileName.slice(0, dot) : fileName
}

export const getFileNameFromPath = (path: string): string => {
  const normalized = path.replace(/\\/g, '/')

  return normalized.substring(normalized.lastIndexOf('/') + 1)
}
