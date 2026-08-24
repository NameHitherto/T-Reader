export interface KnowledgeSeries {
  id: string
  name: string
  description: string
  documentCount: number
  readyDocumentCount: number
  chunkCount: number
  createdAt: string
  updatedAt: string
}

export type KnowledgeDocumentStatus = 'pending' | 'ingesting' | 'ready' | 'error'

export interface KnowledgeDocument {
  id: string
  seriesId: string
  originalFileName: string
  storedFileName: string
  fileHash: string
  title: string
  author: string
  charCount: number
  chunkCount: number
  status: KnowledgeDocumentStatus
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface KnowledgeCitation {
  documentId: string
  bookTitle: string
  chapterTitle: string
  chapterIndex: number
  paragraphIndex: number
  content: string
  score: number
}

export interface KnowledgeQaMessage {
  id: string
  seriesId: string
  role: 'user' | 'assistant'
  content: string
  citations: KnowledgeCitation[]
  providerType: string
  modelId: string
  createdAt: string
}

export interface KnowledgeQaContext {
  seriesId: string
  hasDocuments: boolean
  chunkCount: number
  chatConfigured: boolean
  embeddingConfigured: boolean
  rerankConfigured: boolean
  available: boolean
  reason: string | null
}

export interface KnowledgeIngestProgressEvent {
  documentId: string
  stage: 'copying' | 'parsing' | 'chunking' | 'embedding' | 'done' | 'error'
  processedChunks: number
  totalChunks: number
  message: string
}

export interface KnowledgeAnswerStreamChunk {
  text: string
}

export interface CreateKnowledgeSeriesRequest {
  name: string
  description?: string
}

export interface UpdateKnowledgeSeriesRequest {
  seriesId: string
  name: string
  description?: string
}
