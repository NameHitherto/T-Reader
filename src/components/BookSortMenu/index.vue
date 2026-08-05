<template>
  <div class="book-sort">
    <button
      ref="triggerElement"
      type="button"
      class="book-sort-trigger"
      :class="{ 'book-sort-trigger--active': show }"
      :title="triggerTitle"
      :aria-label="triggerTitle"
      aria-haspopup="true"
      :aria-expanded="show"
      @click.stop="togglePanel"
    >
      <AppIcon name="sortList" :size="18" />
    </button>

    <Teleport to="body">
      <Transition name="book-sort-menu">
        <div
          v-if="show"
          ref="panelElement"
          class="book-sort-menu"
          :style="panelStyle"
          role="menu"
          tabindex="-1"
          @click.stop
        >
          <div class="book-sort-menu-head">
            <span class="book-sort-menu-title">排序方式</span>
            <span class="book-sort-menu-summary"
              >{{ currentOption.label }} · {{ currentOrderLabel }}</span
            >
          </div>
          <div class="book-sort-menu-grid">
            <button
              v-for="option in sortOptions"
              :key="option.key"
              type="button"
              class="sort-tag"
              :class="{ 'sort-tag--active': option.key === sortKey }"
              :aria-pressed="option.key === sortKey"
              @click="handleTagClick(option)"
            >
              <span class="sort-tag-label">{{ option.label }}</span>
              <AppIcon class="sort-tag-icon" :name="tagIconName(option)" :size="14" />
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import AppIcon from '@/components/common/AppIcon/index.vue'
import type { IconName } from '@/icons/registry'
import {
  BOOK_SORT_OPTIONS,
  type BookSortKey,
  type BookSortOption,
  type BookSortOrder,
} from '@/services/book/bookSortService'

defineOptions({
  name: 'BookSortMenu',
})

// ============================================================
// Props / Emits
// ============================================================
const props = defineProps<{
  show: boolean
  sortKey: BookSortKey
  sortOrder: BookSortOrder
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  change: [payload: { key: BookSortKey; order: BookSortOrder }]
}>()

// ============================================================
// 内部状态
// ============================================================
const triggerElement = ref<HTMLElement | null>(null)
const panelElement = ref<HTMLElement | null>(null)
const panelStyle = ref<{ top: string; right: string } | null>(null)

const sortOptions = BOOK_SORT_OPTIONS

const currentOption = computed<BookSortOption>(
  () => BOOK_SORT_OPTIONS.find((option) => option.key === props.sortKey) ?? BOOK_SORT_OPTIONS[0],
)

const currentOrderLabel = computed<string>(() => (props.sortOrder === 'asc' ? '升序' : '降序'))

const triggerTitle = computed<string>(
  () => `排序方式：${currentOption.value.label} · ${currentOrderLabel.value}`,
)

// ============================================================
// 面板定位
// ============================================================
const positionPanel = () => {
  const trigger = triggerElement.value
  if (!trigger) {
    return
  }

  const rect = trigger.getBoundingClientRect()
  panelStyle.value = {
    top: `${rect.bottom + 6}px`,
    right: `${Math.max(8, window.innerWidth - rect.right)}px`,
  }
}

// ============================================================
// 交互
// ============================================================
const togglePanel = () => {
  if (props.show) {
    emit('update:show', false)
    return
  }

  positionPanel()
  emit('update:show', true)
}

const handleTagClick = (option: BookSortOption) => {
  if (option.key === props.sortKey) {
    // 再次点击已激活的关键字：翻转排序方向
    emit('change', {
      key: option.key,
      order: props.sortOrder === 'asc' ? 'desc' : 'asc',
    })
    return
  }

  // 点击未激活的关键字：使用该关键字默认方向
  emit('change', {
    key: option.key,
    order: option.defaultOrder,
  })
}

const tagIconName = (option: BookSortOption): IconName => {
  if (option.key === props.sortKey) {
    return props.sortOrder === 'asc' ? 'sortAsc' : 'sortDesc'
  }

  return option.defaultOrder === 'asc' ? 'sortAsc' : 'sortDesc'
}

// ============================================================
// 外部关闭
// ============================================================
const handleDocumentClick = (event: MouseEvent) => {
  if (!props.show) {
    return
  }

  const target = event.target as Node
  if (!triggerElement.value?.contains(target) && !panelElement.value?.contains(target)) {
    emit('update:show', false)
  }
}

const handleDocumentKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('update:show', false)
    // 焦点归还触发按钮，避免面板移除后焦点丢失
    triggerElement.value?.focus()
  }
}

const handleReposition = () => {
  if (props.show) {
    positionPanel()
  }
}

// 面板打开时，将焦点移入面板（menu 容器 tabindex=-1 可聚焦）
watch(
  () => props.show,
  (visible) => {
    if (visible) {
      nextTick(() => panelElement.value?.focus())
    }
  },
)

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleDocumentKeydown)
  window.addEventListener('resize', handleReposition)
  // capture 捕获内部滚动容器的 scroll，面板随触发按钮位置重定位
  document.addEventListener('scroll', handleReposition, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleDocumentKeydown)
  window.removeEventListener('resize', handleReposition)
  document.removeEventListener('scroll', handleReposition, true)
})
</script>

<style lang="scss" scoped>
.book-sort {
  display: inline-flex;
  position: relative;
}

.book-sort-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 32px;
  padding: 0;
  color: var(--text-secondary);
  background: var(--surface-card-soft);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  cursor: var(--t-mouse-cursor-link), pointer;
  transition:
    color var(--duration-fast) var(--easing-standard),
    border-color var(--duration-fast) var(--easing-standard),
    background-color var(--duration-fast) var(--easing-standard),
    box-shadow var(--duration-fast) var(--easing-standard);

  &:hover {
    color: var(--brand-primary);
    border-color: var(--border-brand);
    background: var(--surface-brand-soft);
  }

  &--active {
    color: var(--brand-primary);
    border-color: var(--border-brand);
    background: var(--surface-brand-soft);
    box-shadow: 0 0 0 2px var(--ring-brand-subtle);
  }

  &:focus-visible {
    outline: 2px solid var(--brand-primary);
    outline-offset: 2px;
  }
}

.book-sort-menu {
  position: fixed;
  z-index: 4800;
  width: 264px;
  padding: 10px;
  box-sizing: border-box;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--surface-strong);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(12px);

  .book-sort-menu-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 6px 10px;

    .book-sort-menu-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .book-sort-menu-summary {
      font-size: 12px;
      color: var(--text-tertiary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .book-sort-menu-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .sort-tag {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    min-width: 0;
    padding: 8px 12px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--border-default);
    background: var(--surface-card-soft);
    color: var(--text-secondary);
    cursor: var(--t-mouse-cursor-link), pointer;
    user-select: none;
    transition:
      color var(--duration-fast) var(--easing-standard),
      border-color var(--duration-fast) var(--easing-standard),
      background-color var(--duration-fast) var(--easing-standard),
      box-shadow var(--duration-fast) var(--easing-standard),
      transform var(--duration-fast) var(--easing-standard);

    .sort-tag-label {
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
    }

    .sort-tag-icon {
      flex-shrink: 0;
      opacity: 0.5;
      transition: opacity var(--duration-fast) var(--easing-standard);
    }

    &:hover {
      color: var(--brand-primary);
      border-color: var(--border-brand);
      background: var(--surface-brand-soft);
      transform: translateY(-1px);
    }

    &:focus-visible {
      outline: 2px solid var(--brand-primary);
      outline-offset: 2px;
    }

    &--active {
      color: var(--brand-primary);
      border-color: var(--border-brand);
      background: var(--surface-brand-soft);
      box-shadow: 0 0 0 2px var(--ring-brand-subtle);

      .sort-tag-icon {
        opacity: 1;
      }
    }
  }
}

.book-sort-menu-enter-active,
.book-sort-menu-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.book-sort-menu-enter-from,
.book-sort-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .book-sort-trigger,
  .book-sort-menu,
  .sort-tag {
    transition: none;
  }

  .book-sort-menu-enter-active,
  .book-sort-menu-leave-active {
    transition: none;
  }
}
</style>
