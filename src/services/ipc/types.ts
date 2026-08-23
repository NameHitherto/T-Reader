export interface PrepareReaderBookDeleteResult {
  acknowledged: boolean
  affected: boolean
  messageId: string
}

export interface ReaderLoadPayload {
  bookKey: string
  cfi?: string
  messageId?: string
}

export interface PrepareBookDeletePayload {
  bookKey: string
  messageId: string
}

export interface BookshelfProgressSavedPayload {
  bookKey: string
  progress: number
  durChapterIndex: number
  durChapterPos: number
  durChapterTitle: string
  durChapterTime: number
}
