export type CloudSyncBookStatus = 'normal' | 'upload' | 'download'

export type CloudSyncBookAction = Extract<CloudSyncBookStatus, 'upload' | 'download'>

export interface CloudSyncPreviewItem {
  fileName: string
  localExists: boolean
  cloudExists: boolean
  status: CloudSyncBookStatus
}

export interface CloudSyncPreviewResult {
  bookItems: CloudSyncPreviewItem[]
  normalCount: number
  uploadCount: number
  downloadCount: number
}

export interface CloudSyncBookSelection {
  fileName: string
  action: CloudSyncBookAction
}

export interface CloudSyncApplyRequest {
  bookSelections: CloudSyncBookSelection[]
}

export interface CloudSyncApplyResult {
  uploadedBookCount: number
  downloadedBookCount: number
  uploadedConfigCount: number
  downloadedConfigCount: number
  replacedConfigCount: number
  skippedCount: number
}
