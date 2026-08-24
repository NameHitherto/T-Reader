<template>
  <div class="shelf-menu">
    <button
      ref="triggerElement"
      type="button"
      class="shelf-menu-trigger"
      :class="{ 'shelf-menu-trigger--active': show }"
      :title="triggerTitle"
      :aria-label="triggerTitle"
      aria-haspopup="true"
      :aria-expanded="show"
      @click.stop="togglePanel"
    >
      <AppIcon name="sortList" :size="18" />
    </button>

    <Teleport to="body">
      <Transition name="shelf-menu">
        <div
          v-if="show"
          ref="panelElement"
          class="shelf-menu-panel"
          :style="panelStyle"
          role="menu"
          tabindex="-1"
          @click.stop
        >
          <div class="shelf-menu-head">
            <span class="shelf-menu-title">书架显示</span>
            <span class="shelf-menu-summary"
              >{{ currentOption.label }} · {{ currentOrderLabel }}</span
            >
          </div>

          <div class="shelf-menu-section">
            <span class="shelf-menu-section-title">排序方式</span>
            <div class="shelf-menu-grid">
              <button
                v-for="option in sortOptions"
                :key="option.key"
                type="button"
                class="shelf-menu-tag"
                :class="{ 'shelf-menu-tag--active': option.key === sortKey }"
                :aria-pressed="option.key === sortKey"
                @click="handleTagClick(option)"
              >
                <span class="shelf-menu-tag-label">{{ option.label }}</span>
                <AppIcon class="shelf-menu-tag-icon" :name="tagIconName(option)" :size="14" />
              </button>
            </div>
          </div>

          <div class="shelf-menu-section">
            <span class="shelf-menu-section-title">视图模式</span>
            <div class="shelf-menu-grid">
              <button
                v-for="view in viewOptions"
                :key="view.mode"
                type="button"
                class="shelf-menu-tag"
                :class="{ 'shelf-menu-tag--active': view.mode === viewMode }"
                :aria-pressed="view.mode === viewMode"
                @click="handleViewClick(view.mode)"
              >
                <span class="shelf-menu-tag-label">{{ view.label }}</span>
                <AppIcon class="shelf-menu-tag-icon" :name="view.icon" :size="14" />
              </button>
            </div>
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
} from '@/services/book/sort'

defineOptions({
  name: 'ShelfMenu',
})

// ============================================================
// 类型声明
// ============================================================
export type ShelfViewMode = 'list' | 'grid'

interface ShelfViewOption {
  mode: ShelfViewMode
  label: string
  icon: IconName
}

// ============================================================
// Props / Emits
// ============================================================
const props = defineProps<{
  show: boolean
  sortKey: BookSortKey
  sortOrder: BookSortOrder
  viewMode: ShelfViewMode
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  change: [payload: { key: BookSortKey; order: BookSortOrder }]
  'view-change': [mode: ShelfViewMode]
}>()

// ============================================================
// 内部状态
// ============================================================
const triggerElement = ref<HTMLElement | null>(null)
const panelElement = ref<HTMLElement | null>(null)
const panelStyle = ref<{ top: string; left: string } | null>(null)

const PANEL_DEFAULT_WIDTH = 264
const VIEWPORT_PADDING = 8

const sortOptions = BOOK_SORT_OPTIONS

const viewOptions: readonly ShelfViewOption[] = [
  { mode: 'list', label: '列表', icon: 'listView' },
  { mode: 'grid', label: '网格', icon: 'gridView' },
]

const currentOption = computed<BookSortOption>(
  () => BOOK_SORT_OPTIONS.find((option) => option.key === props.sortKey) ?? BOOK_SORT_OPTIONS[0],
)

const currentOrderLabel = computed<string>(() => (props.sortOrder === 'asc' ? '升序' : '降序'))

const viewModeLabel = computed<string>(() => (props.viewMode === 'list' ? '列表视图' : '网格视图'))

const triggerTitle = computed<string>(
  () =>
    `书架显示：${viewModeLabel.value} · ${currentOption.value.label} · ${currentOrderLabel.value}`,
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
  const panelWidth = panelElement.value?.offsetWidth || PANEL_DEFAULT_WIDTH
  const triggerCenterX = rect.left + rect.width / 2

  // 计算居中对齐时的 left 坐标：使面板水平中心与按钮水平中心对齐
  const rawLeft = triggerCenterX - panelWidth / 2

  // 边界约束：确保面板不会超出窗口左右边缘
  const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - panelWidth - VIEWPORT_PADDING)
  const clampedLeft = Math.max(VIEWPORT_PADDING, Math.min(rawLeft, maxLeft))

  panelStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${Math.round(clampedLeft)}px`,
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

const handleViewClick = (mode: ShelfViewMode) => {
  emit('view-change', mode)
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
.shelf-menu {
  display: inline-flex;
  position: relative;
}

.shelf-menu-trigger {
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

.shelf-menu-panel {
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
  transform-origin: top center;

  .shelf-menu-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 6px 10px;

    .shelf-menu-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .shelf-menu-summary {
      font-size: 12px;
      color: var(--text-tertiary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .shelf-menu-section {
    padding-top: 10px;

    & + .shelf-menu-section {
      margin-top: 4px;
      border-top: 1px dashed var(--border-soft);
    }

    .shelf-menu-section-title {
      display: block;
      padding: 0 6px 8px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-tertiary);
    }
  }

  .shelf-menu-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .shelf-menu-tag {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    min-width: 0;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
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

    .shelf-menu-tag-label {
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
    }

    .shelf-menu-tag-icon {
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

      .shelf-menu-tag-icon {
        opacity: 1;
      }
    }
  }
}

.shelf-menu-enter-active,
.shelf-menu-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.shelf-menu-enter-from,
.shelf-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .shelf-menu-trigger,
  .shelf-menu-panel,
  .shelf-menu-tag {
    transition: none;
  }

  .shelf-menu-enter-active,
  .shelf-menu-leave-active {
    transition: none;
  }
}
</style>
