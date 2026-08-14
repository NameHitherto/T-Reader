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
          <template v-for="type in underlineTypes" :key="type">
            <span
              class="type-choice"
              :class="{ 'is-selected': type === currentType }"
              @click="updateType(type)"
            >
              {{ typeLabels[type] }}
            </span>
          </template>
        </div>
        <div class="color-picker">
          <span class="picker-label">颜色</span>
          <template v-for="color in colorChoices" :key="color">
            <span
              class="color-choice"
              :class="{ 'is-selected': color === currentColor }"
              :style="{ backgroundColor: color }"
              @click="updateColor(color)"
            />
          </template>
        </div>
        <div class="width-picker">
          <span class="picker-label">粗细</span>
          <template v-for="width in widthChoices" :key="width">
            <span
              class="width-choice"
              :class="{ 'is-selected': width === currentWidth }"
              @click="updateWidth(width)"
            >
              {{ width }}px
            </span>
          </template>
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
  UNDERLINE_WIDTH_CHOICES,
  loadPreferredUnderlineStyle,
  savePreferredUnderlineStyle,
  type UnderlineStyle,
  type UnderlineType,
} from '@/constants/bookmark'
import { logWarn } from '@/utils/logger'
import type { BookMark } from '@/store/bookMark'

const UNDERLINE_TYPE_LABELS: Record<UnderlineType, string> = {
  straight: '直线',
  dashed: '虚线',
  dotted: '点线',
  wavy: '波浪线',
}

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
      widthChoices: [...UNDERLINE_WIDTH_CHOICES],
      typeLabels: UNDERLINE_TYPE_LABELS,
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
  gap: 10px;
  margin-top: 10px;
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

.type-choice,
.width-choice {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--surface-strong);
  font-size: 13px;
  cursor: var(--t-mouse-cursor-link), pointer;

  &.is-selected {
    border-color: var(--brand-primary);
    color: var(--brand-primary);
  }
}

.color-choice {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--surface-strong);
  cursor: var(--t-mouse-cursor-link), pointer;
  box-shadow: var(--shadow-xs);

  &.is-selected {
    border-color: var(--text-primary);
    transform: translateY(-1px);
  }
}
</style>
