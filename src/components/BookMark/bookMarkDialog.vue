<template>
  <el-dialog
    align-center
    destroy-on-close
    title="笔记"
    class="bookmark-dialog-wrapper"
    width="400px"
    :append-to-body="true"
    :show-close="false"
    :close-on-press-escape="false"
    :modal="false"
    @open="onOpen"
    @close="onClose"
  >
    <el-button class="bookmark-delete" type="danger" circle @click="deleteBookMark">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
        <path
          fill="currentColor"
          fill-rule="evenodd"
          d="M5.442 3.5H12.5A1.5 1.5 0 0 1 14 5v6a1.5 1.5 0 0 1-1.5 1.5H5.442a1.5 1.5 0 0 1-1.171-.563L1.796 8.844a1.35 1.35 0 0 1 0-1.688l2.475-3.093A1.5 1.5 0 0 1 5.44 3.5m-2.343-.374A3 3 0 0 1 5.442 2H12.5a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H5.442a3 3 0 0 1-2.343-1.126L.625 9.781a2.85 2.85 0 0 1 0-3.562zM7.28 5.47a.75.75 0 0 0-1.06 1.06L7.69 8L6.22 9.47a.75.75 0 1 0 1.06 1.06l1.47-1.47l1.47 1.47a.75.75 0 1 0 1.06-1.06L9.81 8l1.47-1.47a.75.75 0 0 0-1.06-1.06L8.75 6.94z"
        />
      </svg>
    </el-button>
    <div class="comment-edition">
      <el-input
        v-model="comments"
        maxlength="100"
        :autosize="{ minRows: 2, maxRows: 6 }"
        resize="none"
        type="textarea"
        placeholder="在此编辑个人感想"
        show-word-limit
        @change="bookMarkJSON.comments = comments"
      />
    </div>
    <div class="underline-panel">
      <div class="underline-editor">
        <div class="type-picker">
          <span class="picker-label">线型</span>
          <el-select
            :model-value="currentType"
            class="type-select"
            popper-class="bookmark-type-popper"
            @update:model-value="updateType"
          >
            <template #label>
              <span class="type-preview" v-html="underlinePreviewSvg(currentType)" />
            </template>
            <el-option v-for="type in underlineTypes" :key="type" :value="type">
              <span class="type-preview" v-html="underlinePreviewSvg(type)" />
            </el-option>
          </el-select>
        </div>
        <div class="color-picker">
          <span class="picker-label">颜色</span>
          <div class="color-palette">
            <span
              v-for="color in colorChoices"
              :key="color"
              class="color-choice"
              :class="{ 'is-selected': color === currentColor }"
              :style="{ backgroundColor: color }"
              @click="updateColor(color)"
            />
          </div>
        </div>
        <div class="width-picker">
          <span class="picker-label">粗细</span>
          <el-slider
            v-model="widthValue"
            class="width-slider"
            :min="widthRange.min"
            :max="widthRange.max"
            :step="widthRange.step"
            :format-tooltip="formatWidthTooltip"
            @change="commitWidth"
          />
          <span class="width-value">{{ widthValue }}px</span>
        </div>
      </div>
    </div>
  </el-dialog>
</template>
<script lang="ts">
import { ref, defineComponent } from 'vue'
import {
  UNDERLINE_COLOR_CHOICES,
  UNDERLINE_TYPES,
  UNDERLINE_WIDTH_RANGE,
  loadPreferredUnderlineStyle,
  savePreferredUnderlineStyle,
  type UnderlineStyle,
  type UnderlineType,
} from '@/constants/bookmark'
import { logWarn } from '@/utils/logger'
import type { BookMark } from '@/services/reader/bookmarkState'

export default defineComponent({
  name: 'BookMarkDialog',
  props: {
    bookMarkList: {
      type: String,
    },
  },
  emits: ['update:bookMarkList', 'delete'],
  data() {
    return {
      comments: ref(''),
      bookMarkJSON: ref<Partial<BookMark>>({}),
      colorChoices: [...UNDERLINE_COLOR_CHOICES],
      underlineTypes: [...UNDERLINE_TYPES],
      widthRange: { ...UNDERLINE_WIDTH_RANGE },
      widthValue: 2,
      preferredStyle: loadPreferredUnderlineStyle(),
    }
  },
  computed: {
    currentStyle(): UnderlineStyle {
      return {
        color: this.bookMarkJSON.underlineColor || this.preferredStyle.color,
        type: this.bookMarkJSON.underlineType || this.preferredStyle.type,
        width: this.bookMarkJSON.underlineWidth ?? this.preferredStyle.width,
      }
    },
    currentColor() {
      return this.currentStyle.color
    },
    currentType() {
      return this.currentStyle.type
    },
    currentWidth() {
      return this.currentStyle.width
    },
  },
  methods: {
    async onOpen() {
      // 将string转为json
      if (this.bookMarkList) {
        this.bookMarkJSON = JSON.parse(this.bookMarkList)
        this.comments = this.bookMarkJSON.comments || ''
        this.widthValue = this.currentWidth
      } else {
        logWarn('bookmark', 'open-empty-note')
      }
    },
    async onClose() {
      this.$emit('update:bookMarkList', JSON.stringify(this.bookMarkJSON))
    },
    async deleteBookMark() {
      this.$emit('delete', this.bookMarkJSON.id)
    },
    commitStyle() {
      const style = this.currentStyle
      this.bookMarkJSON.underlineColor = style.color
      this.bookMarkJSON.underlineType = style.type
      this.bookMarkJSON.underlineWidth = style.width
      savePreferredUnderlineStyle(style)
      this.$emit('update:bookMarkList', JSON.stringify(this.bookMarkJSON))
    },
    async updateColor(color: string) {
      this.bookMarkJSON.underlineColor = color
      this.commitStyle()
    },
    async updateType(type: UnderlineType) {
      this.bookMarkJSON.underlineType = type
      this.commitStyle()
    },
    async updateWidth(width: number) {
      this.bookMarkJSON.underlineWidth = width
      this.commitStyle()
    },
    commitWidth() {
      this.updateWidth(this.widthValue)
    },
    formatWidthTooltip(value: number): string {
      return `${value}px`
    },
    underlinePreviewSvg(type: UnderlineType): string {
      const stroke = 'currentColor'
      const wrap = (inner: string) =>
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 24" preserveAspectRatio="none" aria-hidden="true">${inner}</svg>`

      switch (type) {
        case 'brush':
          return wrap(
            `<path d="M4 13 Q 20 16 34 12 T 60 14 T 92 12" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="square"/>`,
          )
        case 'highlighter':
          return wrap(
            `<path d="M4 17 L 92 13" fill="none" stroke="${stroke}" stroke-width="14" stroke-linecap="round" opacity="0.45"/>`,
          )
        case 'spring':
          return wrap(
            `<path d="M4 15 C 12 5 16 23 24 15 C 32 5 36 23 44 15 C 52 5 56 23 64 15 C 72 5 76 23 84 15 C 88 11 90 19 92 15" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>`,
          )
        case 'dotwave':
          return wrap(
            `<path d="M4 13 Q 26 20 48 13 T 92 13" fill="none" stroke="${stroke}" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 10"/>`,
          )
        default:
          return ''
      }
    },
  },
})
</script>
<style lang="scss" scoped>
.bookmark-dialog-wrapper {
  :deep(.el-dialog__body) {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
}

.bookmark-delete {
  position: absolute;
  top: 10px;
  right: 10px;
  color: var(--text-on-brand);
}

.underline-panel {
  margin-top: 4px;
}

.underline-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 18px;
}

.picker-label {
  min-width: 32px;
  font-size: 13px;
  color: var(--text-muted);
}

.type-picker,
.color-picker,
.width-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}

.type-select {
  width: 136px;
}

.type-preview {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 22px;
  color: var(--text-secondary);

  :deep(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
}

.color-palette {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--surface-strong);
  border-radius: var(--radius-sm);
}

.color-choice {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid var(--surface-strong);
  cursor: var(--t-mouse-cursor-link), pointer;
  box-shadow: var(--shadow-xs);

  &.is-selected {
    border-color: var(--text-primary);
    transform: translateY(-1px);
  }
}

.width-slider {
  flex: 1;
  margin-right: 4px;
}

.width-value {
  min-width: 44px;
  font-size: 13px;
  text-align: right;
  color: var(--text-secondary);
}
</style>

<style lang="scss">
.bookmark-type-popper {
  .el-select-dropdown__item {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 34px;
    padding: 0 12px;
  }
}
</style>
