import { Channel, invoke } from '@tauri-apps/api/core'
import type {
  CreateKnowledgeSeriesRequest,
  KnowledgeAnswerStreamChunk,
  KnowledgeDocument,
  KnowledgeIngestProgressEvent,
  KnowledgeQaContext,
  KnowledgeQaMessage,
  KnowledgeSeries,
  UpdateKnowledgeSeriesRequest,
} from '@/services/knowledgeBase/types'

export const listKnowledgeSeries = async (): Promise<KnowledgeSeries[]> => {
  return await invoke<KnowledgeSeries[]>('list_knowledge_series')
}

export const createKnowledgeSeries = async (
  request: CreateKnowledgeSeriesRequest,
): Promise<KnowledgeSeries> => {
  return await invoke<KnowledgeSeries>('create_knowledge_series', { request })
}

export const updateKnowledgeSeries = async (
  request: UpdateKnowledgeSeriesRequest,
): Promise<KnowledgeSeries> => {
  return await invoke<KnowledgeSeries>('update_knowledge_series', { request })
}

export const deleteKnowledgeSeries = async (seriesId: string): Promise<void> => {
  await invoke('delete_knowledge_series', { seriesId })
}

export const listKnowledgeDocuments = async (seriesId: string): Promise<KnowledgeDocument[]> => {
  return await invoke<KnowledgeDocument[]>('list_knowledge_documents', { seriesId })
}

export const importKnowledgeDocuments = async (
  seriesId: string,
  filePaths: string[],
  onProgress: (event: KnowledgeIngestProgressEvent) => void,
): Promise<KnowledgeDocument[]> => {
  const onEvent = new Channel<KnowledgeIngestProgressEvent>((event) => {
    onProgress(event)
  })

  return await invoke<KnowledgeDocument[]>('import_knowledge_documents', {
    seriesId,
    filePaths,
    onEvent,
  })
}

export const reingestKnowledgeDocument = async (
  documentId: string,
  onProgress: (event: KnowledgeIngestProgressEvent) => void,
): Promise<KnowledgeDocument> => {
  const onEvent = new Channel<KnowledgeIngestProgressEvent>((event) => {
    onProgress(event)
  })

  return await invoke<KnowledgeDocument>('reingest_knowledge_document', {
    documentId,
    onEvent,
  })
}

export const deleteKnowledgeDocument = async (documentId: string): Promise<void> => {
  await invoke('delete_knowledge_document', { documentId })
}

export const getKnowledgeQaContext = async (seriesId: string): Promise<KnowledgeQaContext> => {
  return await invoke<KnowledgeQaContext>('get_knowledge_qa_context', { seriesId })
}

export const listKnowledgeQaMessages = async (seriesId: string): Promise<KnowledgeQaMessage[]> => {
  return await invoke<KnowledgeQaMessage[]>('list_knowledge_qa_messages', { seriesId })
}

export const clearKnowledgeQaMessages = async (seriesId: string): Promise<void> => {
  await invoke('clear_knowledge_qa_messages', { seriesId })
}

export const sendKnowledgeQaMessage = async (
  seriesId: string,
  content: string,
  onChunk: (text: string) => void,
): Promise<KnowledgeQaMessage> => {
  const onEvent = new Channel<KnowledgeAnswerStreamChunk>((chunk) => {
    onChunk(chunk.text)
  })

  return await invoke<KnowledgeQaMessage>('send_knowledge_qa_message', {
    request: {
      seriesId,
      content,
    },
    onEvent,
  })
}

export type {
  CreateKnowledgeSeriesRequest,
  KnowledgeAnswerStreamChunk,
  KnowledgeDocument,
  KnowledgeIngestProgressEvent,
  KnowledgeQaContext,
  KnowledgeQaMessage,
  KnowledgeSeries,
  UpdateKnowledgeSeriesRequest,
} from './types'
