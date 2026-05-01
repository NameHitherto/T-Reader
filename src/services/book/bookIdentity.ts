const CONTROL_CHAR_RANGE = '\\u0000-\\u001f'
const INVALID_FILENAME_CHARS = new RegExp(`[<>:"/\\\\|?*${CONTROL_CHAR_RANGE}]`, 'g')
const MULTIPLE_SPACES = /\s+/g

export const normalizeBookIdentityPart = (
  value?: string,
  fallback = 'unknown'
): string => {
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

export const toBookCacheFilename = (bookKey: string): string =>
  `${normalizeBookIdentityPart(bookKey, 'unknown_book')}.json`
