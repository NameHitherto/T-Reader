<template>
  <el-dialog
    :model-value="modelValue"
    align-center
    title="AI绘画"
    class="draw-dialog-wrapper"
    width="560px"
    :append-to-body="true"
    :show-close="false"
    :close-on-press-escape="false"
    :destroy-on-close="false"
    :modal="false"
    @open="onOpen"
    @close="onClose"
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
  >
    <div class="draw-dialog-body">
      <div class="draw-section">
        <span class="draw-section-label">提示词</span>
        <el-input
          v-model="prompt"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 6 }"
          resize="none"
          maxlength="1000"
          show-word-limit
          placeholder="描述想要生成的画面"
          :disabled="isGenerating"
        />
      </div>

      <div class="draw-section">
        <div class="draw-section-header">
          <span class="draw-section-label">参考图（可选）</span>
          <el-button size="small" :disabled="isGenerating" @click="chooseLocalImage">
            本地上传
          </el-button>
        </div>

        <div v-if="selectedReferences.length > 0" class="draw-selected-refs">
          <div v-for="reference in selectedReferences" :key="reference.id" class="draw-ref-item">
            <img :src="reference.previewUrl" alt="" />
            <button
              type="button"
              class="draw-ref-remove"
              :disabled="isGenerating"
              @click="removeReference(reference.id)"
            >
              ×
            </button>
          </div>
        </div>

        <div class="draw-book-images">
          <span class="draw-book-images-title">本书图片</span>
          <div v-if="bookImages.length === 0" class="draw-book-images-empty">本书内无可用图片</div>
          <el-scrollbar v-else max-height="140px">
            <div class="draw-book-images-grid">
              <div
                v-for="bookImage in bookImages"
                :key="bookImage.id"
                class="draw-book-image"
                :class="{ 'is-selected': isBookImageSelected(bookImage.id) }"
                @click="toggleBookImage(bookImage)"
              >
                <img :src="bookImage.previewUrl" alt="" />
              </div>
            </div>
          </el-scrollbar>
        </div>
      </div>
    </div>

    <template #footer>
      <span v-if="isGenerating" class="draw-footer-hint">已有生成任务进行中…</span>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
      <el-button
        type="primary"
        :loading="isGenerating"
        :disabled="isGenerating || prompt.trim().length === 0"
        @click="generate"
      >
        生成
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { ElMessage } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import { EpubRenditionLike } from '@/types/epub'
import { stageReferenceImage } from '@/services/gallery/galleryRepository'
import {
  imageGenerationTask,
  startImageGenerationTask,
} from '@/services/gallery/imageGenerationTaskService'
import { logError, logInfo } from '@/utils/logger'
import { generateID } from '@/utils/id'

interface ReferenceImage {
  id: string
  /** 若来自本书图片，记录 manifest id，避免重复添加 */
  bookImageId: string | null
  blob: Blob
  mimeType: string
  previewUrl: string
}

interface BookImageEntry {
  id: string
  blob: Blob
  mimeType: string
  previewUrl: string
}

interface LocalImageFile {
  bytes: number[]
  extension: string
  mimeType: string
}

const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const props = defineProps<{
  modelValue: boolean
  bookKey: string | null
  initialPrompt: string
  rendition: EpubRenditionLike | null
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>()

const prompt = ref('')
const bookImages = ref<BookImageEntry[]>([])
const selectedReferences = ref<ReferenceImage[]>([])

const isGenerating = computed(() => imageGenerationTask.status === 'generating')

let bookImagesLoadedForBookKey: string | null = null

const revokeBookImagePreviews = () => {
  for (const bookImage of bookImages.value) {
    URL.revokeObjectURL(bookImage.previewUrl)
  }
  bookImages.value = []
  bookImagesLoadedForBookKey = null
}

const revokeReferencePreviews = () => {
  for (const reference of selectedReferences.value) {
    URL.revokeObjectURL(reference.previewUrl)
  }
  selectedReferences.value = []
}

const loadBookImages = async () => {
  if (bookImagesLoadedForBookKey === props.bookKey) {
    return
  }
  revokeBookImagePreviews()

  const book = props.rendition?.book
  try {
    await book?.ready
  } catch (error) {
    logError('draw-dialog', 'wait book ready failed', error)
  }

  const manifest = book?.packaging?.manifest
  const archive = book?.archive
  if (!manifest || !archive?.getBlob) {
    bookImagesLoadedForBookKey = props.bookKey
    return
  }

  const entries: BookImageEntry[] = []
  for (const [manifestId, item] of Object.entries(manifest)) {
    if (!item?.type?.startsWith('image/') || !SUPPORTED_IMAGE_MIME_TYPES.includes(item.type)) {
      continue
    }
    try {
      const resolvedPath = book?.resolve ? book.resolve(item.href) : item.href
      if (!resolvedPath) {
        continue
      }
      // 注意：getBlob 内部依赖 this.zip，必须以 archive 为调用方
      const blob = await archive.getBlob(resolvedPath, item.type)
      if (!blob || blob.size === 0) {
        continue
      }
      entries.push({
        id: manifestId,
        blob,
        mimeType: item.type,
        previewUrl: URL.createObjectURL(blob),
      })
    } catch (error) {
      logError('draw-dialog', `load book image failed href=${item.href}`, error)
    }
  }

  bookImages.value = entries
  bookImagesLoadedForBookKey = props.bookKey
  logInfo('draw-dialog', `book images loaded count=${entries.length}`)
}

const isBookImageSelected = (bookImageId: string): boolean => {
  return selectedReferences.value.some((reference) => reference.bookImageId === bookImageId)
}

const toggleBookImage = (bookImage: BookImageEntry) => {
  if (isGenerating.value) {
    return
  }
  const existing = selectedReferences.value.find(
    (reference) => reference.bookImageId === bookImage.id,
  )
  if (existing) {
    removeReference(existing.id)
    return
  }

  selectedReferences.value.push({
    id: generateID(6),
    bookImageId: bookImage.id,
    blob: bookImage.blob,
    mimeType: bookImage.mimeType,
    previewUrl: URL.createObjectURL(bookImage.blob),
  })
}

const removeReference = (referenceId: string) => {
  const index = selectedReferences.value.findIndex((reference) => reference.id === referenceId)
  if (index < 0) {
    return
  }
  URL.revokeObjectURL(selectedReferences.value[index].previewUrl)
  selectedReferences.value.splice(index, 1)
}

const chooseLocalImage = async () => {
  try {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    })
    if (typeof selected !== 'string' || selected.length === 0) {
      return
    }

    const result = await invoke<LocalImageFile>('read_local_cover_file', { filepath: selected })
    const bytes = new Uint8Array(result.bytes)
    const blob = new Blob([bytes], { type: result.mimeType })
    selectedReferences.value.push({
      id: generateID(6),
      bookImageId: null,
      blob,
      mimeType: result.mimeType,
      previewUrl: URL.createObjectURL(blob),
    })
  } catch (error) {
    logError('draw-dialog', 'choose local image failed', error)
    ElMessage.error(String(error))
  }
}

const resolveBookTitle = async (): Promise<string | null> => {
  try {
    const metadata = await props.rendition?.book?.loaded?.metadata

    return metadata?.title ?? null
  } catch {
    return null
  }
}

/**
 * 触发生成后弹窗立即挂起（关闭），任务在后台继续，
 * 状态通过右下角状态栏展示。
 */
const generate = async () => {
  if (isGenerating.value || prompt.value.trim().length === 0) {
    return
  }

  try {
    const referencePaths: string[] = []
    for (const reference of selectedReferences.value) {
      const bytes = new Uint8Array(await reference.blob.arrayBuffer())
      referencePaths.push(await stageReferenceImage(bytes, reference.mimeType))
    }

    const started = startImageGenerationTask({
      prompt: prompt.value.trim(),
      bookKey: props.bookKey,
      bookTitle: await resolveBookTitle(),
      referencePaths,
    })
    if (!started) {
      ElMessage.warning('已有生成任务进行中，请稍后再试')
      return
    }

    emit('update:modelValue', false)
  } catch (error) {
    logError('draw-dialog', 'start generate task failed', error)
    ElMessage.error(String(error))
  }
}

const onOpen = () => {
  prompt.value = props.initialPrompt
  void loadBookImages()
}

const onClose = () => {
  revokeReferencePreviews()
}

watch(
  () => props.bookKey,
  () => {
    // 换书后书内图片与参考图不再有效
    revokeBookImagePreviews()
    revokeReferencePreviews()
  },
)
</script>

<style lang="scss" scoped>
.draw-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.draw-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.draw-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.draw-section-label {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  user-select: none;
}

.draw-footer-hint {
  margin-right: 10px;
  color: var(--text-tertiary);
  font-size: 12px;
  user-select: none;
}

.draw-selected-refs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.draw-ref-item {
  position: relative;
  width: 56px;
  height: 56px;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border: 1px solid var(--border-brand);
    border-radius: var(--radius-sm);
  }
}

.draw-ref-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  color: var(--text-inverse, #fff);
  font-size: 12px;
  line-height: 1;
  background: var(--brand-primary);
  border: none;
  border-radius: 50%;
  cursor: var(--t-mouse-cursor-link), pointer;
}

.draw-book-images {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.draw-book-images-title {
  color: var(--text-tertiary);
  font-size: 12px;
  user-select: none;
}

.draw-book-images-empty {
  padding: 12px 0;
  color: var(--text-tertiary);
  font-size: 12px;
  text-align: center;
  user-select: none;
}

.draw-book-images-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.draw-book-image {
  width: 56px;
  height: 56px;
  overflow: hidden;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  cursor: var(--t-mouse-cursor-link), pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &.is-selected {
    border-color: var(--brand-primary);
  }
}
</style>
