import { reactive, readonly } from 'vue'
import { GenerateGalleryImageRequest } from '@/types/gallery'
import { generateGalleryImage } from '@/services/gallery/galleryRepository'
import { dispatchMainEvent } from '@/services/reader/readerWindowBridgeService'
import { WINDOW_EVENTS } from '@/constants/events'
import { logError, logInfo } from '@/utils/logger'

export type ImageGenerationStatus = 'idle' | 'generating' | 'success' | 'error'

interface ImageGenerationTaskState {
  status: ImageGenerationStatus
  prompt: string
  errorMessage: string
  lastImageId: string | null
}

const SUCCESS_RESET_DELAY_MS = 6000
const ERROR_RESET_DELAY_MS = 12000

const state = reactive<ImageGenerationTaskState>({
  status: 'idle',
  prompt: '',
  errorMessage: '',
  lastImageId: null,
})

let resetTimer: number | null = null

const clearResetTimer = () => {
  if (resetTimer !== null) {
    window.clearTimeout(resetTimer)
    resetTimer = null
  }
}

const scheduleReset = (delayMs: number) => {
  clearResetTimer()
  resetTimer = window.setTimeout(() => {
    resetTimer = null
    if (state.status !== 'generating') {
      state.status = 'idle'
      state.errorMessage = ''
    }
  }, delayMs)
}

/** 只读的生图任务状态，供状态栏/弹窗展示 */
export const imageGenerationTask = readonly(state)

export const isImageGenerationBusy = (): boolean => state.status === 'generating'

/** 手动关闭成功/失败提示（生成中不可关闭） */
export const dismissImageGenerationStatus = () => {
  if (state.status === 'generating') {
    return
  }
  clearResetTimer()
  state.status = 'idle'
  state.errorMessage = ''
}

/**
 * 启动后台生图任务。弹窗触发后即可关闭，任务状态由本模块持有，
 * 完成后通知主窗口刷新画廊。
 * @returns 是否成功启动（已有任务在进行时返回 false）
 */
export const startImageGenerationTask = (request: GenerateGalleryImageRequest): boolean => {
  if (state.status === 'generating') {
    return false
  }

  clearResetTimer()
  state.status = 'generating'
  state.prompt = request.prompt
  state.errorMessage = ''
  state.lastImageId = null

  void (async () => {
    try {
      const record = await generateGalleryImage(request)
      state.status = 'success'
      state.lastImageId = record.id
      logInfo('image-gen', `generated id=${record.id}`)
      void dispatchMainEvent(WINDOW_EVENTS.GALLERY_IMAGE_CREATED, { id: record.id })
      scheduleReset(SUCCESS_RESET_DELAY_MS)
    } catch (error) {
      state.status = 'error'
      state.errorMessage = String(error)
      logError('image-gen', 'generate image failed', error)
      scheduleReset(ERROR_RESET_DELAY_MS)
    }
  })()

  return true
}
