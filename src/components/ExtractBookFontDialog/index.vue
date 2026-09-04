<template>
  <el-dialog
    :model-value="modelValue"
    align-center
    append-to-body
    class="extract-book-font-dialog-wrapper"
    destroy-on-close
    :show-close="!isExtracting"
    width="min(860px, calc(100vw - 60px))"
    @update:model-value="handleVisibilityChange"
    @open="handleOpen"
  >
    <template #header>
      <div class="dialog-header">
        <span class="dialog-header__title">解析书籍内置字体</span>
      </div>
    </template>

    <div v-loading="loadingBooks" class="extract-dialog-content">
      <!-- 搜索与全选工具栏 -->
      <div v-if="epubBooks.length > 0" class="extract-toolbar">
        <el-input
          v-model="searchKeyword"
          clearable
          placeholder="搜索书籍标题或文件名"
          class="toolbar-search"
          :disabled="isExtracting"
        />

        <div class="toolbar-actions">
          <el-checkbox
            :model-value="isAllSelected"
            :indeterminate="isIndeterminate"
            :disabled="isExtracting || filteredBooks.length === 0"
            @change="toggleSelectAll"
          >
            全选 (已选 {{ selectedCount }} / {{ filteredBooks.length }})
          </el-checkbox>
        </div>
      </div>

      <!-- 书籍列表 -->
      <div v-if="epubBooks.length > 0" class="book-list-container">
        <el-scrollbar v-if="filteredBooks.length > 0" class="book-list-scroll">
          <div class="book-list">
            <div
              v-for="book in filteredBooks"
              :key="book.fileName"
              class="book-item"
              :class="{
                'book-item--selected': book.selected,
                'book-item--extracting': book.status === 'extracting',
              }"
            >
              <div class="book-item__checkbox">
                <el-checkbox v-model="book.selected" :disabled="isExtracting" />
              </div>

              <div class="book-item__cover">
                <img
                  v-if="book.coverUrl"
                  :src="book.coverUrl"
                  :alt="book.title"
                  class="cover-image"
                  loading="lazy"
                />
                <div v-else class="cover-fallback">
                  <AppIcon name="bookOpen" :size="20" />
                </div>
              </div>

              <div class="book-item__info">
                <div class="book-item__title" :title="book.title">
                  {{ book.title }}
                </div>
                <div class="book-item__meta">
                  <span v-if="book.author" class="meta-author" :title="book.author">
                    {{ book.author }} ·
                  </span>
                  <span class="meta-file" :title="book.fileName">
                    {{ book.fileName }}
                  </span>
                </div>
              </div>

              <div class="book-item__status">
                <el-tag
                  v-if="book.status === 'extracting'"
                  type="primary"
                  effect="plain"
                  size="small"
                >
                  <span class="status-loading-text">解析中...</span>
                </el-tag>

                <el-tag
                  v-else-if="book.status === 'extracted'"
                  type="success"
                  effect="plain"
                  size="small"
                >
                  提取了 {{ book.extractedCount }} 个字体
                </el-tag>

                <el-tag
                  v-else-if="book.status === 'existing'"
                  type="warning"
                  effect="plain"
                  size="small"
                >
                  字体已存在
                </el-tag>

                <el-tag
                  v-else-if="book.status === 'skipped'"
                  type="info"
                  effect="plain"
                  size="small"
                >
                  无内嵌字体
                </el-tag>

                <el-tag
                  v-else-if="book.status === 'failed'"
                  type="danger"
                  effect="plain"
                  size="small"
                  :title="book.reason || '解析失败'"
                >
                  解析失败
                </el-tag>

                <el-tag v-else type="info" effect="light" size="small"> 未解析 </el-tag>
              </div>

              <div class="book-item__action">
                <el-button
                  size="small"
                  :disabled="isExtracting"
                  :loading="book.status === 'extracting'"
                  @click="extractSingleBook(book)"
                >
                  解析
                </el-button>
              </div>
            </div>
          </div>
        </el-scrollbar>

        <el-empty v-else description="没有匹配的书籍" :image-size="80" class="extract-empty" />
      </div>

      <!-- 无 EPUB 书籍时的空状态 -->
      <el-empty
        v-else-if="!loadingBooks"
        description="本地书库中没有发现 EPUB 格式的书籍，请先在书架中导入书籍"
        :image-size="100"
        class="extract-empty"
      />
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-summary">
          <span v-if="summaryText">{{ summaryText }}</span>
        </div>

        <div class="footer-actions">
          <el-button :disabled="isExtracting" @click="closeDialog">
            {{ hasExtractedAny ? '完成' : '取消' }}
          </el-button>
          <el-button
            type="primary"
            :loading="isExtracting"
            :disabled="selectedCount === 0"
            @click="startBatchExtraction"
          >
            开始解析选中书籍 ({{ selectedCount }})
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { listLocalBookFiles, loadBookConfigs, resolveBookCoverForDisplay } from '@/services/book'
import type { StoredBookRecord } from '@/services/book/types'
import { extractEpubFonts } from '@/services/reader/localFonts'
import defaultCover from '@/assets/default-cover.png'
import AppIcon from '@/components/common/AppIcon/index.vue'
import { ElMessage } from 'element-plus'

interface BookItemState {
  fileName: string
  title: string
  author: string
  coverUrl: string
  selected: boolean
  status: 'idle' | 'extracting' | 'extracted' | 'existing' | 'skipped' | 'failed'
  extractedCount: number
  reason: string | null
}

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'extracted'): void
}>()

const FONT_NOTIFICATION_OFFSET = 60

const loadingBooks = ref(false)
const isExtracting = ref(false)
const searchKeyword = ref('')
const epubBooks = ref<BookItemState[]>([])
const hasExtractedAny = ref(false)
const summaryText = ref('')

const filteredBooks = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return epubBooks.value

  return epubBooks.value.filter(
    (b) => b.title.toLowerCase().includes(kw) || b.fileName.toLowerCase().includes(kw),
  )
})

const selectedBooks = computed(() => {
  return filteredBooks.value.filter((b) => b.selected)
})

const selectedCount = computed(() => selectedBooks.value.length)

const isAllSelected = computed(() => {
  return filteredBooks.value.length > 0 && filteredBooks.value.every((b) => b.selected)
})

const isIndeterminate = computed(() => {
  const count = selectedCount.value

  return count > 0 && count < filteredBooks.value.length
})

const toggleSelectAll = (val: string | number | boolean) => {
  const checked = Boolean(val)
  filteredBooks.value.forEach((book) => {
    book.selected = checked
  })
}

const loadEpubBooks = async () => {
  loadingBooks.value = true
  summaryText.value = ''
  hasExtractedAny.value = false

  try {
    const [allFiles, storedBooks] = await Promise.all([
      listLocalBookFiles().catch(() => []),
      loadBookConfigs().catch(() => []),
    ])

    const storedByFilename = new Map<string, StoredBookRecord>()
    for (const item of storedBooks) {
      if (item.record.fileName) {
        storedByFilename.set(item.record.fileName.toLowerCase(), item.record)
      }
    }

    const epubFiles = allFiles.filter((file) => file.toLowerCase().endsWith('.epub'))

    epubBooks.value = await Promise.all(
      epubFiles.map(async (fileName) => {
        const record = storedByFilename.get(fileName.toLowerCase())
        const title = record?.title || fileName.replace(/\.epub$/i, '')
        const author = record?.author || ''
        const coverUrl = record
          ? await resolveBookCoverForDisplay(record, defaultCover).catch(() => '')
          : ''

        return {
          fileName,
          title,
          author,
          coverUrl,
          selected: true,
          status: 'idle',
          extractedCount: 0,
          reason: null,
        }
      }),
    )
  } catch (error) {
    ElMessage.error({
      message: `读取书籍列表失败: ${String(error)}`,
      offset: FONT_NOTIFICATION_OFFSET,
    })
    epubBooks.value = []
  } finally {
    loadingBooks.value = false
  }
}

const handleOpen = () => {
  searchKeyword.value = ''
  void loadEpubBooks()
}

const handleVisibilityChange = (value: boolean) => {
  if (isExtracting.value) return
  emit('update:modelValue', value)
}

const closeDialog = () => {
  if (isExtracting.value) return
  emit('update:modelValue', false)
}

const extractBook = async (
  book: BookItemState,
): Promise<{
  extracted: number
  existing: number
  skipped: number
  failed: number
}> => {
  book.status = 'extracting'
  book.reason = null

  try {
    const results = await extractEpubFonts(book.fileName)
    let extracted = 0
    let existing = 0
    let skipped = 0
    let failed = 0

    for (const res of results) {
      if (res.status === 'extracted') {
        extracted += res.fonts.length
      } else if (res.status === 'existing') {
        existing += res.fonts.length
      } else if (res.status === 'skipped') {
        skipped += 1
      } else if (res.status === 'failed') {
        failed += 1
      }
    }

    book.extractedCount = extracted

    if (extracted > 0) {
      book.status = 'extracted'
      hasExtractedAny.value = true
    } else if (existing > 0) {
      book.status = 'existing'
    } else if (failed > 0) {
      book.status = 'failed'
      const firstFailure = results.find((r) => r.status === 'failed')
      book.reason = firstFailure?.reason || '字体提取失败'
    } else {
      book.status = 'skipped'
    }

    return { extracted, existing, skipped, failed }
  } catch (error) {
    book.status = 'failed'
    book.reason = String(error)
    return { extracted: 0, existing: 0, skipped: 0, failed: 1 }
  }
}

const extractSingleBook = async (book: BookItemState) => {
  const res = await extractBook(book)
  if (res.extracted > 0) {
    emit('extracted')
    ElMessage.success({
      message: `《${book.title}》提取成功，新增 ${res.extracted} 个字体`,
      offset: FONT_NOTIFICATION_OFFSET,
    })
  } else if (res.existing > 0) {
    ElMessage.info({
      message: `《${book.title}》内置字体已存在于字体库中`,
      offset: FONT_NOTIFICATION_OFFSET,
    })
  } else if (book.status === 'skipped') {
    ElMessage.info({
      message: `《${book.title}》未检测到可提取的内嵌字体`,
      offset: FONT_NOTIFICATION_OFFSET,
    })
  } else if (book.status === 'failed') {
    ElMessage.error({
      message: `《${book.title}》解析失败: ${book.reason || '未知错误'}`,
      offset: FONT_NOTIFICATION_OFFSET,
    })
  }
}

const startBatchExtraction = async () => {
  const targets = selectedBooks.value
  if (targets.length === 0) return

  isExtracting.value = true
  summaryText.value = '正在解析书籍内置字体...'

  let totalExtracted = 0
  let totalExisting = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (const book of targets) {
    const res = await extractBook(book)
    totalExtracted += res.extracted
    totalExisting += res.existing
    totalSkipped += res.skipped
    totalFailed += res.failed
  }

  isExtracting.value = false

  summaryText.value = `解析完成：共发现 ${totalExtracted} 个新字体，${totalExisting} 个已存在，${totalSkipped} 个无内嵌字体${totalFailed > 0 ? `，${totalFailed} 个解析失败` : ''}`

  if (totalExtracted > 0) {
    emit('extracted')
    ElMessage.success({
      message: `解析完成，共成功提取 ${totalExtracted} 个字体！`,
      offset: FONT_NOTIFICATION_OFFSET,
    })
  } else if (totalExisting > 0) {
    ElMessage.info({
      message: '所选书籍的内置字体均已存在于本地字体库',
      offset: FONT_NOTIFICATION_OFFSET,
    })
  } else {
    ElMessage.info({
      message: '所选书籍中未检测到可提取的内嵌字体',
      offset: FONT_NOTIFICATION_OFFSET,
    })
  }
}
</script>

<style scoped lang="scss">
.extract-book-font-dialog-wrapper {
  display: flex;
  flex-direction: column;
  color: var(--text-primary);
}

.dialog-header {
  display: flex;
  align-items: center;

  &__title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
  }
}

.extract-dialog-content {
  display: flex;
  flex-direction: column;
  height: 480px;
  min-height: 0;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--surface-strong);
  overflow: hidden;
}

.extract-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-soft);
  background: var(--surface-card);

  .toolbar-search {
    max-width: 320px;
  }
}

.book-list-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.book-list-scroll {
  flex: 1;
  min-height: 0;
}

.book-list {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  gap: 6px;
}

.book-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-card);
  border: 1px solid var(--border-soft);
  transition: all var(--duration-fast) var(--easing-standard);

  &:hover {
    background: var(--surface-card-soft);
    border-color: var(--border-default);
  }

  &--selected {
    border-color: var(--border-brand);
    background: var(--surface-brand-soft);
  }

  &--extracting {
    border-color: var(--brand-primary);
  }

  &__checkbox {
    flex-shrink: 0;
  }

  &__cover {
    width: 38px;
    height: 52px;
    flex-shrink: 0;
    border-radius: 4px;
    overflow: hidden;
    background: var(--surface-inset);
    border: 1px solid var(--border-soft);

    .cover-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .cover-fallback {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-tertiary);
    }
  }

  &__info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  &__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-muted);
    min-width: 0;

    .meta-author {
      flex-shrink: 0;
      max-width: 140px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .meta-file {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  &__status {
    flex-shrink: 0;
  }

  &__action {
    flex-shrink: 0;
  }
}

.extract-empty {
  margin: auto 0;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;

  .footer-summary {
    font-size: 13px;
    color: var(--brand-primary);
    font-weight: 500;
  }

  .footer-actions {
    display: flex;
    gap: 10px;
  }
}
</style>
