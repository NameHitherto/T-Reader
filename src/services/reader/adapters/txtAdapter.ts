import { splitTextToParagraphs } from '@/services/reader/txtReaderService'

export interface TxtRenderResult {
  paragraphs: string[]
  paragraphIndex: number
}

export const renderTxtBook = (bookData: Uint8Array, paragraphIndex = 0): TxtRenderResult => {
  const textContent = new TextDecoder().decode(bookData)
  const paragraphs = splitTextToParagraphs(textContent)
  const safeIndex = Math.max(0, Math.min(Math.floor(paragraphIndex), Math.max(0, paragraphs.length - 1)))

  return {
    paragraphs,
    paragraphIndex: safeIndex,
  }
}
