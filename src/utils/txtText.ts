export const splitTextToParagraphs = (rawText: string): string[] => {
  const normalized = rawText.replace(/\r\n/g, '\n')
  const splitByBlankLine = normalized
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)

  if (splitByBlankLine.length > 0) {
    return splitByBlankLine
  }

  return normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}
