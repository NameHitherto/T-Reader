import { splitTextToParagraphs } from '@/services/reader/txtReaderService'

export interface TxtRenderResult {
  paragraphs: string[]
  location: string
  progress: number
}

export const renderTxtBook = (
  bookData: Uint8Array,
  location?: string,
  progress?: number
): TxtRenderResult => {
  const textContent = new TextDecoder().decode(bookData)

  return {
    paragraphs: splitTextToParagraphs(textContent),
    location: location || '0',
    progress: progress || 0,
  }
}
