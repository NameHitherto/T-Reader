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

export const buildBookIdentity = (title?: string, author?: string): string => {
  const safeTitle = normalizeBookIdentityPart(title, 'untitled')
  const safeAuthor = normalizeBookIdentityPart(author, 'unknown')
  return `${safeTitle}_${safeAuthor}`
}

export const toBookConfigFilename = (id: string): string => `${id}.json`

export const toBookCacheFilename = (title?: string, author?: string): string =>
  `${buildBookIdentity(title, author)}.json`
