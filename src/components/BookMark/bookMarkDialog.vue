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
    <div class="color-picker">
      <template v-for="preset in colorChoices" :key="preset.background">
        <span
          class="color-choice"
          :class="{ 'is-selected': preset.background === bookMarkJSON.color }"
          :style="{ backgroundColor: preset.background, color: preset.text }"
          @click="updateColor(preset.background)"
        >
          A
        </span>
      </template>
    </div>
  </el-dialog>
</template>
<script lang="ts">
import { ref, defineComponent } from 'vue'
import { BOOKMARK_HIGHLIGHT_PRESETS, type BookmarkHighlightPreset } from '@/constants/bookmark'
import { logWarn } from '@/utils/logger'
import type { BookMark } from '@/store/bookMark'
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
      colorChoices: [...BOOKMARK_HIGHLIGHT_PRESETS] as BookmarkHighlightPreset[],
    }
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
    async updateColor(color: string) {
      this.bookMarkJSON.color = color
      this.$emit('update:bookMarkList', JSON.stringify(this.bookMarkJSON))
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
.color-picker {
  display: inline-flex;
  margin-top: 10px;
  gap: 8px;

  .color-choice {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 2px solid var(--surface-strong);
    border-width: 2px;
    cursor: var(--t-mouse-cursor-link), pointer;
    box-shadow: var(--shadow-xs);
    font-size: 14px;
    font-weight: 700;
    line-height: 1;

    &.is-selected {
      border-color: var(--text-primary);
      transform: translateY(-1px);
    }
  }
}
</style>
