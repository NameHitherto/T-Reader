<template>
  <el-dialog
    v-model="visible"
    title="元数据编辑"
    width="520px"
    destroy-on-close
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    @closed="reset"
  >
    <el-form label-position="top" @submit.prevent="save">
      <el-form-item label="书名" required>
        <el-input v-model="form.title" maxlength="200" show-word-limit :disabled="saving" />
      </el-form-item>
      <el-form-item label="作者" required>
        <el-input v-model="form.author" maxlength="200" show-word-limit :disabled="saving" />
      </el-form-item>
      <el-form-item label="封面">
        <div class="cover-editor">
          <div class="cover-preview">
            <img v-if="coverPreview" :src="coverPreview" alt="封面预览" />
            <span v-else>暂无封面</span>
          </div>
          <div class="cover-actions">
            <el-button :disabled="saving" @click="chooseCover">选择图片</el-button>
            <el-button
              v-if="coverSelected || hasExistingCover"
              :disabled="saving"
              @click="removeCover"
            >
              移除封面
            </el-button>
            <div class="cover-hint">支持 JPG/JPEG、PNG、WebP，大小不超过 5MB</div>
          </div>
        </div>
      </el-form-item>
      <el-alert v-if="errorMessage" type="error" :closable="false" show-icon>
        {{ errorMessage }}
      </el-alert>
    </el-form>
    <template #footer>
      <el-button class="first" :disabled="saving" @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { ElMessage } from 'element-plus'
import {
  getStoredBookByKey,
  loadBookConfig,
  saveBookConfig,
  updateBookCover,
  updateBookMetadata,
} from '@/services/book/bookRepository'
import defaultCover from '@/assets/default-cover.png'
import {
  migrateBookCache,
  removeBookCoverResource,
  resolveBookCoverForDisplay,
  saveUploadedBookCover,
} from '@/services/book/bookCacheService'
import {
  buildLocalFilePath,
  LOCAL_DIRS,
  removeLocalFile,
} from '@/services/fileSystem/localStorageService'
import { toBookConfigFilename } from '@/services/book/bookIdentity'
import { prepareReaderBookDelete } from '@/services/reader/readerWindowBridgeService'
import type { StoredBookRecord } from '@/services/book/bookRepositoryTypes'
import { logWarn } from '@/utils/logger'

const MAX_COVER_BYTES = 5 * 1024 * 1024

const props = defineProps<{ modelValue: boolean; bookKey: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [bookKey: string] }>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const form = reactive({ title: '', author: '' })
const originalRecord = ref<StoredBookRecord | null>(null)
const oldConfig = ref<{
  name: string
  author: string
  durChapterIndex: number
  durChapterPos: number
  durChapterTitle: string
  durChapterTime: number
} | null>(null)
const coverPreview = ref('')
const coverBytes = ref<Uint8Array | null>(null)
type CoverExtension = 'jpg' | 'png' | 'webp'

interface LocalCoverFile {
  bytes: number[]
  extension: CoverExtension
  mimeType: string
}

const coverExtension = ref<CoverExtension>('jpg')
const coverSelected = ref(false)
const coverRemoved = ref(false)
const saving = ref(false)
const errorMessage = ref('')
let previewObjectUrl = ''

const hasExistingCover = computed(() =>
  Boolean(originalRecord.value?.hasCover && originalRecord.value.coverName),
)

const reset = () => {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl)
    previewObjectUrl = ''
  }
  form.title = ''
  form.author = ''
  originalRecord.value = null
  oldConfig.value = null
  coverPreview.value = ''
  coverBytes.value = null
  coverSelected.value = false
  coverRemoved.value = false
  errorMessage.value = ''
}

const load = async () => {
  if (!props.modelValue || !props.bookKey) return
  reset()
  try {
    const [record, config] = await Promise.all([
      getStoredBookByKey(props.bookKey),
      loadBookConfig(props.bookKey),
    ])
    if (!record) throw new Error('未找到书籍信息')
    originalRecord.value = record
    oldConfig.value = config
    form.title = record.title || config.name
    form.author = record.author || config.author
    coverPreview.value = await resolveBookCoverForDisplay(record, defaultCover)
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  }
}

watch(
  () => props.modelValue,
  (value) => {
    if (value) void load()
  },
)

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return '操作失败，请稍后重试'
}

const chooseCover = async () => {
  errorMessage.value = ''
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
  })
  if (!selected || Array.isArray(selected)) return

  try {
    const result = await invoke<LocalCoverFile>('read_local_cover_file', { filepath: selected })
    const bytes = new Uint8Array(result.bytes)
    if (bytes.byteLength > MAX_COVER_BYTES) throw new Error('封面大小不能超过 5MB')
    coverExtension.value = result.extension
    coverBytes.value = bytes
    coverSelected.value = true
    coverRemoved.value = false
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
    previewObjectUrl = URL.createObjectURL(new Blob([bytes], { type: result.mimeType }))
    coverPreview.value = previewObjectUrl
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  }
}

const removeCover = () => {
  coverBytes.value = null
  coverSelected.value = false
  coverRemoved.value = true
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl)
    previewObjectUrl = ''
  }
  coverPreview.value = ''
}

const save = async () => {
  if (saving.value) return
  const title = form.title.trim()
  const author = form.author.trim()
  if (!title || !author) {
    errorMessage.value = '书名和作者不能为空'
    return
  }
  const record = originalRecord.value
  const config = oldConfig.value
  if (!record || !config) {
    errorMessage.value = '书籍信息尚未加载完成'
    return
  }

  saving.value = true
  errorMessage.value = ''
  try {
    const readerCleanup = await prepareReaderBookDelete(record.bookKey)
    if (readerCleanup.affected) {
      throw new Error('该书正在阅读窗口中，请关闭阅读窗口后再保存。')
    }

    const metadataResult = await updateBookMetadata({
      bookKey: record.bookKey,
      title,
      author,
    })
    const nextRecord = metadataResult.book
    const nextConfig = {
      ...config,
      name: nextRecord.title,
      author: nextRecord.author,
    }

    if (metadataResult.oldBookKey !== nextRecord.bookKey) {
      await migrateBookCache(metadataResult.oldBookKey, nextRecord.bookKey, record.coverName)
      await saveBookConfig(nextRecord.bookKey, nextConfig)
      await removeLocalFile(
        buildLocalFilePath(LOCAL_DIRS.progress, toBookConfigFilename(metadataResult.oldBookKey)),
      )
      await invoke('webdav_delete', {
        subdir: 'bookProgress',
        filename: toBookConfigFilename(metadataResult.oldBookKey),
      }).catch((error) => logWarn('book-metadata', 'delete old cloud config failed', error))
    } else {
      await saveBookConfig(nextRecord.bookKey, nextConfig)
    }

    let finalRecord = nextRecord
    if (coverSelected.value && coverBytes.value) {
      const coverName = await saveUploadedBookCover(
        nextRecord.bookKey,
        coverBytes.value,
        coverExtension.value,
      )
      finalRecord = await updateBookCover(nextRecord.bookKey, true, coverName)
      if (record.coverName && record.coverName !== coverName) {
        await removeBookCoverResource(nextRecord.bookKey, record.coverName)
      }
    } else if (coverRemoved.value && record.hasCover) {
      finalRecord = await updateBookCover(nextRecord.bookKey, false, null)
      await removeBookCoverResource(nextRecord.bookKey, record.coverName)
    }

    emit('saved', finalRecord.bookKey)
    visible.value = false
    ElMessage.success('书籍元数据已更新')
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.cover-editor {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.cover-preview {
  width: 110px;
  height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--surface-card-soft);
  color: var(--text-tertiary);
}

.cover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cover-hint {
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.5;
}

.first {
  margin-right: 8px;
}
</style>
