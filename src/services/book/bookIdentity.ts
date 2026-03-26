const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g
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

export const buildBookName = (title?: string, author?: string): string => {
  const safeTitle = normalizeBookIdentityPart(title, 'untitled')
  const safeAuthor = normalizeBookIdentityPart(author, 'unknown')
  return `${safeTitle}_${safeAuthor}`
}

export const toBookConfigFilename = (bookName: string): string => `${bookName}.json`

export const toBookCacheFilename = (title?: string, author?: string): string =>
  `${buildBookName(title, author)}.json`
