export type BookChatRole = 'user' | 'assistant'

export interface BookChatMessage {
  id: string
  role: BookChatRole
  content: string
  providerType: string
  modelId: string
  createdAt: string
}

export interface BookChatContextInfo {
  bookKey: string
  bookTitle: string
  author: string
  textCharCount: number
  maxTextChars: number
  modelConfigured: boolean
  available: boolean
  reason: string | null
}

export interface BookChatStreamChunk {
  text: string
}
