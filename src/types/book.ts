export type BookFormat = 'epub' | 'txt'

export interface BookProgressSnapshot {
  durChapterIndex: number
  durChapterPos: number
  durChapterTitle: string
  durChapterTime: number
}

export interface BookConfig extends BookProgressSnapshot {
  name: string
  author: string
}
