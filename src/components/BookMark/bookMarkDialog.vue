<template>
  <el-dialog
    :model-value="modelValue"
    align-center
    destroy-on-close
    class="bookmark-dialog-wrapper"
    modal-class="bookmark-dialog-overlay"
    width="440px"
    :append-to-body="true"
    :show-close="false"
    :close-on-press-escape="true"
    :close-on-click-modal="true"
    @open="handleOpen"
    @close="onClose"
    @update:model-value="(val: boolean) => emit('update:modelValue', val)"
  >
    <template #header>
      <div class="dialog-header">
        <div class="header-title-wrap">
          <span class="header-icon-box">
            <AppIcon name="bookmark" :size="15" />
          </span>
          <span class="header-title">编辑划线笔记</span>
        </div>
      </div>
    </template>

    <div class="dialog-content">
      <!-- 个人感想编辑区 -->
      <div class="comment-section">
        <div class="section-head">
          <span class="section-title">笔记感想</span>
          <span class="char-count" :class="{ 'is-limit': comments.length >= 500 }">
            {{ comments.length }} / 500
          </span>
        </div>
        <el-input
          v-model="comments"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 5 }"
          resize="none"
          maxlength="500"
          placeholder="在此写下阅读感悟、批注或心得..."
          class="comment-input"
          @input="handleCommentInput"
        />
      </div>

      <!-- 划线样式控制面板 -->
      <div class="style-panel">
        <!-- 线型卡片网格选择器 -->
        <div class="type-section">
          <span class="section-label">线型风格</span>
          <div class="type-grid">
            <button
              v-for="item in LINE_TYPES"
              :key="item.type"
              type="button"
              class="type-card"
              :class="{ 'is-active': item.type === currentType }"
              @click="updateType(item.type)"
            >
              <div class="type-card-preview" v-html="underlinePreviewSvg(item.type)" />
              <div class="type-card-info">
                <span class="type-card-label">{{ item.label }}</span>
                <span class="type-card-desc">{{ item.desc }}</span>
              </div>
              <span v-if="item.type === currentType" class="type-card-badge">
                <svg
                  viewBox="0 0 16 16"
                  width="10"
                  height="10"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="3 8.5 6.5 12 13 4" />
                </svg>
              </span>
            </button>
          </div>
        </div>

        <!-- 调色盘 -->
        <div class="color-section">
          <span class="section-label">划线色彩</span>
          <div class="color-palette">
            <button
              v-for="color in colorChoices"
              :key="color"
              type="button"
              class="color-choice"
              :class="{ 'is-selected': color === currentColor }"
              :style="{ '--swatch-color': color }"
              :title="color"
              :aria-label="`选择划线颜色 ${color}`"
              @click="updateColor(color)"
            >
              <span class="color-dot" :style="{ backgroundColor: color }">
                <svg
                  class="check-icon"
                  :class="{ 'is-active': color === currentColor }"
                  :style="{ color: isLightColor(color) ? '#1f2937' : '#ffffff' }"
                  viewBox="0 0 16 16"
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
                </svg>
              </span>
            </button>
          </div>
        </div>

        <!-- 粗细滑块 -->
        <div class="width-section">
          <span class="section-label">粗细微调</span>
          <div class="width-row">
            <span class="width-icon thin" title="更细">
              <span class="line-bar line-bar--thin"></span>
            </span>
            <el-slider
              :model-value="widthValue"
              class="width-slider"
              :min="widthRange.min"
              :max="widthRange.max"
              :step="widthRange.step"
              :show-tooltip="false"
              @input="onSliderInput"
              @change="onSliderChange"
            />
            <span class="width-icon thick" title="更粗">
              <span class="line-bar line-bar--thick"></span>
            </span>
            <span class="width-badge">{{ widthValue.toFixed(1) }} px</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="emit('update:modelValue', false)">取消</el-button>
        <el-button type="primary" @click="saveAndClose">完成</el-button>
      </div>
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  UNDERLINE_COLOR_CHOICES,
  UNDERLINE_WIDTH_RANGE,
  loadPreferredUnderlineStyle,
  savePreferredUnderlineStyle,
  type UnderlineStyle,
  type UnderlineType,
} from '@/services/reader'
import { logWarn } from '@/utils/logger'
import type { BookMark } from '@/services/reader/bookmarkState'
import AppIcon from '@/components/common/AppIcon/index.vue'

interface Props {
  modelValue?: boolean
  bookMarkList?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  bookMarkList: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:bookMarkList', value: string): void
  (e: 'delete', markId: string): void
}>()

interface LineTypeMeta {
  type: UnderlineType
  label: string
  desc: string
}

const LINE_TYPES: LineTypeMeta[] = [
  { type: 'brush', label: '毛笔', desc: '手绘墨迹起伏' },
  { type: 'highlighter', label: '荧光', desc: '半透明马克笔' },
  { type: 'spring', label: '弹簧', desc: '趣味回旋卷线' },
  { type: 'dotwave', label: '波浪', desc: '律动波点虚线' },
]

const comments = ref('')
const bookMarkJSON = ref<Partial<BookMark>>({})
const colorChoices = [...UNDERLINE_COLOR_CHOICES]
const widthRange = { ...UNDERLINE_WIDTH_RANGE }
const widthValue = ref(2)
const preferredStyle = ref<UnderlineStyle>(loadPreferredUnderlineStyle())

const currentStyle = computed<UnderlineStyle>(() => ({
  color: bookMarkJSON.value.underlineColor || preferredStyle.value.color,
  type: bookMarkJSON.value.underlineType || preferredStyle.value.type,
  width: bookMarkJSON.value.underlineWidth ?? preferredStyle.value.width,
}))

const currentColor = computed(() => currentStyle.value.color)
const currentType = computed(() => currentStyle.value.type)
const currentWidth = computed(() => currentStyle.value.width)

const isLightColor = (color: string): boolean => {
  const hex = color.replace('#', '')
  if (hex.length !== 6) return false
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  return lum > 0.65
}

const handleOpen = () => {
  preferredStyle.value = loadPreferredUnderlineStyle()
  if (props.bookMarkList) {
    try {
      bookMarkJSON.value = JSON.parse(props.bookMarkList)
      comments.value = bookMarkJSON.value.comments || ''
      widthValue.value = currentWidth.value
    } catch {
      logWarn('bookmark', 'failed-to-parse-bookmark-json')
    }
  } else {
    logWarn('bookmark', 'open-empty-note')
  }
}

watch(
  () => props.bookMarkList,
  (newVal) => {
    if (!newVal || !props.modelValue) return
    try {
      bookMarkJSON.value = JSON.parse(newVal)
      comments.value = bookMarkJSON.value.comments || ''
      widthValue.value = currentWidth.value
    } catch {
      // ignore
    }
  },
)

const commitStyle = () => {
  const style: UnderlineStyle = {
    color: currentColor.value,
    type: currentType.value,
    width: currentWidth.value,
  }
  bookMarkJSON.value.underlineColor = style.color
  bookMarkJSON.value.underlineType = style.type
  bookMarkJSON.value.underlineWidth = style.width
  savePreferredUnderlineStyle(style)
  emit('update:bookMarkList', JSON.stringify(bookMarkJSON.value))
}

const updateColor = (color: string) => {
  bookMarkJSON.value.underlineColor = color
  commitStyle()
}

const updateType = (type: UnderlineType) => {
  bookMarkJSON.value.underlineType = type
  commitStyle()
}

const updateWidth = (width: number) => {
  bookMarkJSON.value.underlineWidth = width
  commitStyle()
}

const onSliderInput = (val: number | number[]) => {
  const num = typeof val === 'number' ? val : val[0]
  widthValue.value = num
  bookMarkJSON.value.underlineWidth = num
}

const onSliderChange = (val: number | number[]) => {
  const num = typeof val === 'number' ? val : val[0]
  updateWidth(num)
}

const handleCommentInput = () => {
  bookMarkJSON.value.comments = comments.value
}

const saveAndClose = () => {
  bookMarkJSON.value.comments = comments.value
  commitStyle()
  emit('update:modelValue', false)
}

const onClose = () => {
  bookMarkJSON.value.comments = comments.value
  commitStyle()
}

const underlinePreviewSvg = (type: UnderlineType): string => {
  const stroke = 'currentColor'
  const wrap = (inner: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 24" preserveAspectRatio="none" aria-hidden="true">${inner}</svg>`

  switch (type) {
    case 'brush':
      return wrap(
        `<path d="M4 13 Q 20 16 34 12 T 60 14 T 92 12" fill="none" stroke="${stroke}" stroke-width="6" stroke-linecap="square"/>`,
      )
    case 'highlighter':
      return wrap(
        `<path d="M4 14 L 92 14" fill="none" stroke="${stroke}" stroke-width="12" stroke-linecap="round" opacity="0.45"/>`,
      )
    case 'spring':
      return wrap(
        `<path d="M4 15 C 12 5 16 23 24 15 C 32 5 36 23 44 15 C 52 5 56 23 64 15 C 72 5 76 23 84 15 C 88 11 90 19 92 15" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>`,
      )
    case 'dotwave':
      return wrap(
        `<path d="M4 13 Q 26 20 48 13 T 92 13" fill="none" stroke="${stroke}" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="1 8"/>`,
      )
    default:
      return ''
  }
}
</script>
<style lang="scss" scoped>
.bookmark-dialog-wrapper {
  :deep(.el-dialog__header) {
    padding: 16px 20px 0;
  }

  :deep(.el-dialog__body) {
    padding: 16px 20px 20px;
  }

  :deep(.el-dialog__footer) {
    padding: 0 20px 18px;
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  width: 100%;

  .header-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;

    .header-icon-box {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: var(--radius-xs);
      background: var(--surface-brand-soft);
      color: var(--brand-primary);
    }

    .header-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
      letter-spacing: 0.2px;
    }
  }
}

.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.comment-section {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .char-count {
    font-size: 11px;
    color: var(--text-muted);

    &.is-limit {
      color: var(--danger);
    }
  }

  .comment-input {
    :deep(.el-textarea__inner) {
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      background: var(--surface-card-soft);
      border: 1px solid var(--border-default);
      color: var(--text-primary);
      font-size: 13px;
      line-height: 1.6;
      transition:
        border-color var(--duration-fast) var(--easing-standard),
        box-shadow var(--duration-fast) var(--easing-standard);

      &::placeholder {
        color: var(--text-muted);
      }

      &:focus {
        border-color: var(--brand-primary);
        box-shadow: 0 0 0 3px var(--ring-brand-soft);
      }
    }
  }
}

.style-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-card-muted);
  border: 1px solid var(--border-soft);

  .section-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }
}

.type-section {
  display: flex;
  flex-direction: column;

  .type-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .type-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-card);
    cursor: var(--t-mouse-cursor-pointer), pointer;
    text-align: left;
    transition:
      border-color var(--duration-fast) var(--easing-standard),
      background-color var(--duration-fast) var(--easing-standard),
      transform var(--duration-fast) var(--easing-standard);

    &:hover {
      border-color: var(--border-brand);
      background: var(--surface-card-soft);
      transform: translateY(-1px);
    }

    &.is-active {
      border-color: var(--brand-primary);
      background: var(--surface-brand-soft);
      box-shadow: 0 0 0 1px var(--brand-primary);

      .type-card-label {
        color: var(--brand-primary);
        font-weight: 600;
      }
    }

    .type-card-preview {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 18px;
      flex-shrink: 0;
      color: var(--text-secondary);

      :deep(svg) {
        display: block;
        width: 100%;
        height: 100%;
      }
    }

    .type-card-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .type-card-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      line-height: 1.2;
    }

    .type-card-desc {
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.3;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .type-card-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--brand-primary);
      color: #ffffff;
    }
  }
}

.color-section {
  display: flex;
  flex-direction: column;

  .color-palette {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: var(--surface-card);
    border: 1px solid var(--border-default);
  }

  .color-choice {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: var(--t-mouse-cursor-pointer), pointer;
    transition: transform var(--duration-base) var(--easing-standard);

    &:hover {
      transform: scale(1.08);
    }

    &.is-selected {
      .color-dot {
        box-shadow:
          0 0 0 2px var(--surface-strong),
          0 0 0 4px var(--swatch-color);
      }
    }

    .color-dot {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 1.5px solid rgba(0, 0, 0, 0.08);
      box-shadow: var(--shadow-xs);
      transition:
        transform var(--duration-base) var(--easing-standard);
    }

    .check-icon {
      display: block;
      opacity: 0;
      transform: scale(0.6);
      transition:
        opacity var(--duration-base) var(--easing-standard),
        transform var(--duration-base) var(--easing-standard);

      &.is-active {
        opacity: 1;
        transform: scale(1);
      }
    }
  }
}

.width-section {
  display: flex;
  flex-direction: column;

  .width-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .width-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: var(--text-tertiary);
    flex-shrink: 0;

    .line-bar {
      display: block;
      background: currentColor;

      &--thin {
        width: 12px;
        height: 1.5px;
        border-radius: 1px;
      }

      &--thick {
        width: 14px;
        height: 4.5px;
        border-radius: 2px;
      }
    }
  }

  .width-slider {
    flex: 1;
    margin: 0 2px;
  }

  .width-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 52px;
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    background: var(--surface-card);
    border: 1px solid var(--border-default);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}
</style>
