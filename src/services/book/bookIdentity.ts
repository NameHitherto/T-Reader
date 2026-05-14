const CONTROL_CHAR_RANGE = '\\u0000-\\u001f'
const INVALID_FILENAME_CHARS = new RegExp(`[<>:"/\\\\|?*${CONTROL_CHAR_RANGE}]`, 'g')
const MULTIPLE_SPACES = /\s+/g

export const normalizeBookIdentityPart = (value?: string, fallback = 'unknown'): string => {
  const sanitized = (value || '')
    .replace(INVALID_FILENAME_CHARS, '_')
    .replace(MULTIPLE_SPACES, ' ')
    .trim()

  return sanitized || fallback
}

export const buildBookTitle = (title?: string): string => {
  return normalizeBookIdentityPart(title, 'untitled')
}

export const buildBookName = (title?: string, author?: string): string => {
  const safeTitle = normalizeBookIdentityPart(title, 'untitled')
  const safeAuthor = normalizeBookIdentityPart(author, 'unknown')

  return `${safeTitle}_${safeAuthor}`
}

export const toBookConfigFilename = (bookKey: string): string => `${bookKey}.json`

export const getBookKeyFromConfigFilename = (filename: string): string => {
  return filename.replace(/\.json$/i, '')
}

export const hashBookKey = async (bookKey: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bookKey))

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
