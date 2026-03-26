import { splitTextToParagraphs } from '@/services/reader/txtReaderService'

export interface TxtRenderResult {
  paragraphs: string[]
  location: string
}

export const renderTxtBook = (bookData: Uint8Array, location?: string): TxtRenderResult => {
  const textContent = new TextDecoder().decode(bookData)

  return {
    paragraphs: splitTextToParagraphs(textContent),
    location: location || '0',
  }
}
