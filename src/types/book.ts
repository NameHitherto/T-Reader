export type BookFormat = 'epub'

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
