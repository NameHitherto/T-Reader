<template>
  <div class="gallery">
    <div v-if="bookFilterTags.length > 0" class="gallery-tags">
      <button
        type="button"
        class="gallery-tag"
        :class="{ 'is-active': filterBookKey === '' }"
        @click="filterBookKey = ''"
      >
        全部
      </button>
      <button
        v-for="tag in bookFilterTags"
        :key="tag.value"
        type="button"
        class="gallery-tag"
        :class="{ 'is-active': filterBookKey === tag.value }"
        :title="tag.label"
        @click="toggleFilter(tag.value)"
      >
        {{ tag.label }}
      </button>
    </div>

    <div class="gallery-body">
      <el-scrollbar class="gallery-scrollbar">
        <div v-if="displayedImages.length === 0" class="gallery-empty">暂无生成的图片</div>
        <div v-else class="gallery-grid">
          <div
            v-for="image in displayedImages"
            :key="image.id"
            class="gallery-card"
            @click="openDetail(image)"
          >
            <div class="gallery-card-thumb">
              <img v-if="assetUrls[image.imagePath]" :src="assetUrls[image.imagePath]" alt="" />
            </div>
            <div class="gallery-card-meta">
              <p class="gallery-card-prompt" :title="image.prompt">{{ image.prompt }}</p>
              <span class="gallery-card-book">{{ image.bookTitle || '无来源书籍' }}</span>
            </div>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <el-dialog
      v-model="detailVisible"
      class="gallery-detail-dialog"
      align-center
      destroy-on-close
      :append-to-body="true"
      width="720px"
    >
      <template #header>
        <span class="gallery-detail-title">图片详情</span>
      </template>
      <div v-if="detailImage" class="gallery-detail">
        <div class="gallery-detail-image">
          <img
            v-if="assetUrls[detailImage.imagePath]"
            :src="assetUrls[detailImage.imagePath]"
            alt=""
          />
        </div>
        <div class="gallery-detail-fields">
          <div class="gallery-detail-field">
            <span class="gallery-detail-label">提示词</span>
            <p class="gallery-detail-value gallery-detail-prompt">{{ detailImage.prompt }}</p>
          </div>
          <div class="gallery-detail-field">
            <span class="gallery-detail-label">来源书籍</span>
            <span class="gallery-detail-value">{{ detailImage.bookTitle || '无' }}</span>
          </div>
          <div class="gallery-detail-field">
            <span class="gallery-detail-label">模型</span>
            <span class="gallery-detail-value">
              {{ detailImage.modelId || '未知' }}
              <template v-if="detailImage.providerType"
                >（{{ detailImage.providerType }}）</template
              >
            </span>
          </div>
          <div class="gallery-detail-field">
            <span class="gallery-detail-label">创建时间</span>
            <span class="gallery-detail-value">{{ formatCreatedAt(detailImage.createdAt) }}</span>
          </div>
          <div v-if="detailReferencePaths.length > 0" class="gallery-detail-field">
            <span class="gallery-detail-label">参考图</span>
            <div class="gallery-detail-refs">
              <img
                v-for="refPath in detailReferencePaths"
                :key="refPath"
                :src="assetUrls[refPath]"
                alt=""
              />
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button type="danger" plain @click="deleteDetailImage">删除</el-button>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { ElMessage, ElMessageBox } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import { GalleryImage, parseGalleryReferencePaths } from '@/types/gallery'
import { deleteGalleryImage, listGalleryImages } from '@/services/gallery/galleryRepository'
import { buildGalleryAssetUrl } from '@/services/gallery/galleryAssetService'
import { WINDOW_EVENTS } from '@/constants/events'
import { formatDate } from '@/utils/date'
import { logError } from '@/utils/logger'

const images = ref<GalleryImage[]>([])
const filterBookKey = ref<string>('')
const assetUrls = reactive<Record<string, string>>({})
const detailVisible = ref(false)
const detailImage = ref<GalleryImage | null>(null)

/** 无来源书籍图片的筛选专用值 */
const NO_BOOK_FILTER = '__none__'

let unlistenImageCreated: UnlistenFn | null = null

const bookFilterTags = computed(() => {
  const seen = new Map<string, string>()
  let hasNoBookImages = false
  for (const image of images.value) {
    if (image.bookKey) {
      if (!seen.has(image.bookKey)) {
        seen.set(image.bookKey, image.bookTitle || image.bookKey)
      }
    } else {
      hasNoBookImages = true
    }
  }

  const tags = Array.from(seen, ([value, label]) => ({ value, label }))
  if (hasNoBookImages && tags.length > 0) {
    tags.push({ value: NO_BOOK_FILTER, label: '无来源书籍' })
  }

  return tags
})

const displayedImages = computed(() => {
  if (!filterBookKey.value) {
    return images.value
  }
  if (filterBookKey.value === NO_BOOK_FILTER) {
    return images.value.filter((image) => !image.bookKey)
  }

  return images.value.filter((image) => image.bookKey === filterBookKey.value)
})

const toggleFilter = (value: string) => {
  filterBookKey.value = filterBookKey.value === value ? '' : value
}

// 删除后若当前筛选的书籍不再有图片，回退到"全部"
watch(bookFilterTags, (tags) => {
  if (filterBookKey.value && !tags.some((tag) => tag.value === filterBookKey.value)) {
    filterBookKey.value = ''
  }
})

const detailReferencePaths = computed(() => {
  if (!detailImage.value) {
    return []
  }

  return parseGalleryReferencePaths(detailImage.value.referencePaths)
})

const ensureAssetUrl = async (relativePath: string) => {
  if (assetUrls[relativePath]) {
    return
  }
  try {
    assetUrls[relativePath] = await buildGalleryAssetUrl(relativePath)
  } catch (error) {
    logError('gallery', `build asset url failed path=${relativePath}`, error)
  }
}

const reloadImages = async () => {
  try {
    images.value = await listGalleryImages()
    await Promise.all(
      images.value.flatMap((image) => [
        ensureAssetUrl(image.imagePath),
        ...parseGalleryReferencePaths(image.referencePaths).map(ensureAssetUrl),
      ]),
    )
  } catch (error) {
    logError('gallery', 'load gallery images failed', error)
    ElMessage.error(`加载画廊失败: ${String(error)}`)
  }
}

const openDetail = (image: GalleryImage) => {
  detailImage.value = image
  detailVisible.value = true
}

const formatCreatedAt = (createdAt: string): string => {
  const parsed = new Date(`${createdAt.replace(' ', 'T')}Z`)

  return Number.isNaN(parsed.getTime()) ? createdAt : formatDate(parsed)
}

const deleteDetailImage = async () => {
  const target = detailImage.value
  if (!target) {
    return
  }

  try {
    await ElMessageBox.confirm('删除后无法恢复，确定删除这张图片吗？', '删除图片', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  try {
    await deleteGalleryImage(target.id)
    detailVisible.value = false
    detailImage.value = null
    await reloadImages()
    ElMessage.success('图片已删除')
  } catch (error) {
    logError('gallery', `delete gallery image failed id=${target.id}`, error)
    ElMessage.error(`删除失败: ${String(error)}`)
  }
}

onMounted(async () => {
  await reloadImages()
  try {
    unlistenImageCreated = await listen(WINDOW_EVENTS.GALLERY_IMAGE_CREATED, () => {
      void reloadImages()
    })
  } catch (error) {
    logError('gallery', 'register gallery-image-created listener failed', error)
  }
})

onBeforeUnmount(() => {
  unlistenImageCreated?.()
  unlistenImageCreated = null
})
</script>

<style lang="scss" scoped>
.gallery {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 18px 22px 0;
}

.gallery-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
  user-select: none;
}

.gallery-tag {
  max-width: 200px;
  padding: 5px 12px;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--surface-strong);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-pill);
  cursor: var(--t-mouse-cursor-link), pointer;
  transition:
    color var(--duration-fast) var(--easing-standard),
    border-color var(--duration-fast) var(--easing-standard),
    background-color var(--duration-fast) var(--easing-standard);

  &:hover {
    color: var(--brand-primary);
    border-color: var(--border-brand);
  }

  &.is-active {
    color: var(--brand-primary);
    font-weight: 700;
    background: var(--surface-brand-soft);
    border-color: var(--border-brand);
  }
}

.gallery-body {
  flex: 1;
  min-height: 0;
  padding-bottom: 18px;
}

.gallery-scrollbar {
  height: 100%;
}

.gallery-empty {
  padding: 60px 0;
  color: var(--text-tertiary);
  font-size: 14px;
  text-align: center;
  user-select: none;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
  padding-right: 6px;
}

.gallery-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface-strong);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  cursor: var(--t-mouse-cursor-link), pointer;
  transition:
    border-color var(--duration-fast) var(--easing-standard),
    box-shadow var(--duration-fast) var(--easing-standard);

  &:hover {
    border-color: var(--border-brand);
    box-shadow: var(--shadow-sm);
  }
}

.gallery-card-thumb {
  aspect-ratio: 1 / 1;
  overflow: hidden;
  background: var(--surface-brand-soft);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.gallery-card-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
}

.gallery-card-prompt {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.gallery-card-book {
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gallery-detail-title {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
}

.gallery-detail {
  display: flex;
  gap: 18px;
}

.gallery-detail-image {
  flex: 0 0 380px;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--surface-brand-soft);

  img {
    display: block;
    width: 100%;
    height: auto;
  }
}

.gallery-detail-fields {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.gallery-detail-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gallery-detail-label {
  color: var(--text-tertiary);
  font-size: 12px;
}

.gallery-detail-value {
  color: var(--text-primary);
  font-size: 13px;
  word-break: break-all;
}

.gallery-detail-prompt {
  max-height: 140px;
  margin: 0;
  overflow-y: auto;
  white-space: pre-wrap;
}

.gallery-detail-refs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  img {
    width: 64px;
    height: 64px;
    object-fit: cover;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-sm);
  }
}
</style>
