<template>
  <Teleport to="body">
    <Transition name="annotation-bubble">
      <div
        v-if="visible && bookmark"
        ref="bubbleRef"
        class="annotation-bubble"
        :class="[themeMode, placement]"
        :style="bubbleStyle"
        @pointerdown.stop
        @click.stop
        @contextmenu.stop
      >
        <div class="bubble-arrow" :style="{ left: `${arrowLeft}px` }"></div>

        <div class="bubble-header">
          <div class="header-left">
            <span
              class="color-dot"
              :style="{ backgroundColor: bookmark.underlineColor || 'var(--brand-primary)' }"
            />
            <span class="bubble-title">注释笔记</span>
          </div>
          <div class="header-actions">
            <button class="action-btn" title="编辑笔记" @click="handleEdit">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
            <button class="action-btn" title="关闭" @click="handleClose">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div class="bubble-body">
          <div v-if="bookmark.comments && bookmark.comments.trim()" class="bubble-comment">
            {{ bookmark.comments }}
          </div>
          <div v-else class="bubble-empty">
            <span class="empty-hint">暂无笔记内容</span>
            <button class="add-btn" @click="handleEdit">添加笔记</button>
          </div>
        </div>

        <div v-if="bookmark.createTime" class="bubble-footer">
          <span class="create-time">{{ bookmark.createTime }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BookMark } from '@/services/reader/bookmarkState'
import type { BookmarkBubblePosition } from '@/composables/useBookmarkBubble'

const props = defineProps<{
  visible: boolean
  bookmark: BookMark | null
  position: BookmarkBubblePosition
  themeMode?: 'light' | 'dark'
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'edit', markId: string): void
}>()

const bubbleRef = ref<HTMLElement | null>(null)

const placement = computed(() => props.position.placement)
const arrowLeft = computed(() => props.position.arrowLeft)

const bubbleStyle = computed(() => ({
  top: `${props.position.top}px`,
  left: `${props.position.left}px`,
}))

function handleClose() {
  emit('close')
}

function handleEdit() {
  if (props.bookmark?.id) {
    emit('edit', props.bookmark.id)
  }
}

defineExpose({
  bubbleRef,
})
</script>

<style scoped lang="scss">
.annotation-bubble {
  position: fixed;
  z-index: 4650;
  width: 320px;
  max-width: calc(100vw - 24px);
  background: var(--surface-strong);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md, 8px);
  box-shadow: var(--shadow-lg);
  padding: 12px 14px;
  color: var(--text-primary);
  user-select: none;
}

.bubble-arrow {
  position: absolute;
  width: 10px;
  height: 10px;
  background: var(--surface-strong);
  border: 1px solid var(--border-default);
  transform: rotate(45deg);
}

.annotation-bubble.top .bubble-arrow {
  bottom: -6px;
  border-top: none;
  border-left: none;
}

.annotation-bubble.bottom .bubble-arrow {
  top: -6px;
  border-bottom: none;
  border-right: none;
}

.bubble-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;

    .color-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .bubble-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border: none;
      background: transparent;
      border-radius: 4px;
      color: var(--text-tertiary);
      cursor: pointer;
      transition:
        background-color 0.15s ease,
        color 0.15s ease;

      &:hover {
        background: var(--surface-inset);
        color: var(--text-primary);
      }
    }
  }
}

.bubble-body {
  margin-bottom: 8px;

  .bubble-comment {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-word;
    user-select: text;
    max-height: 180px;
    overflow-y: auto;
  }

  .bubble-empty {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 4px;
    font-size: 12px;

    .empty-hint {
      color: var(--text-muted);
    }

    .add-btn {
      border: none;
      background: var(--surface-brand-soft);
      color: var(--brand-primary);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;

      &:hover {
        background: var(--surface-brand-soft-strong);
      }
    }
  }
}

.bubble-footer {
  display: flex;
  justify-content: flex-end;
  font-size: 11px;
  color: var(--text-muted);
}

.annotation-bubble-enter-active,
.annotation-bubble-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s cubic-bezier(0.16, 1, 0.3, 1);
}

.annotation-bubble-enter-from,
.annotation-bubble-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
