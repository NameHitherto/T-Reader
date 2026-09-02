<template>
  <Teleport to="body">
    <Transition name="search-backdrop">
      <div v-if="visible" class="search-backdrop" aria-hidden="true" @click="handleClose"></div>
    </Transition>
    <Transition name="search-panel">
      <section
        v-if="visible"
        class="search-panel"
        role="dialog"
        aria-label="书籍内容搜索"
        @keydown.esc.prevent="handleClose"
      >
        <header class="search-panel-header">
          <div class="search-input-wrap">
            <span class="search-input-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
                <path
                  fill="currentColor"
                  d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5l-1.5 1.5l-5-5v-.79l-.27-.27A6.5 6.5 0 0 1 9.5 16A6.5 6.5 0 0 1 3 9.5A6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14S14 12 14 9.5S12 5 9.5 5"
                />
              </svg>
            </span>
            <input
              ref="inputRef"
              class="search-input"
              type="text"
              :value="keyword"
              placeholder="搜索本书内容"
              autocomplete="off"
              spellcheck="false"
              @input="handleInput"
              @keydown.enter.prevent="handleEnter"
            />
            <button
              v-if="keyword"
              type="button"
              class="search-input-clear"
              aria-label="清空关键词"
              @click="handleClearKeyword"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14">
                <path
                  fill="currentColor"
                  d="M6.4 19L5 17.6l5.6-5.6L5 6.4L6.4 5l5.6 5.6L17.6 5L19 6.4L13.4 12l5.6 5.6l-1.4 1.4l-5.6-5.6z"
                />
              </svg>
            </button>
          </div>
        </header>

        <div v-if="statusText" class="search-panel-status">
          <span class="search-status-text">
            <span v-if="searching" class="search-spinner" aria-hidden="true"></span>
            {{ statusText }}
          </span>
          <button
            v-if="hasHighlight"
            type="button"
            class="search-clear-highlight"
            @click="emit('clear-highlight')"
          >
            清除高亮
          </button>
        </div>

        <div class="search-panel-body">
          <p v-if="!hasSearched" class="search-placeholder">检索结果在此展示。</p>
          <p v-else-if="hits.length === 0 && !searching" class="search-placeholder">
            没有找到匹配的内容。
          </p>
          <ul v-else class="search-result-list">
            <li v-for="hit in hits" :key="hit.id">
              <button
                type="button"
                class="search-result-item"
                :class="{ 'search-result-item--active': hit.id === activeHitId }"
                @click="handleSelect(hit)"
              >
                <span class="search-result-chapter">{{ hit.chapterTitle }}</span>
                <span class="search-result-excerpt">
                  <template v-for="(segment, index) in buildSegments(hit.excerpt)" :key="index">
                    <mark v-if="segment.matched" class="search-result-matched">{{
                      segment.text
                    }}</mark>
                    <template v-else>{{ segment.text }}</template>
                  </template>
                </span>
              </button>
            </li>
          </ul>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { ReaderSearchHit } from '@/services/reader/search'

interface ExcerptSegment {
  text: string
  matched: boolean
}

const props = defineProps<{
  visible: boolean
  keyword: string
  hits: ReaderSearchHit[]
  searching: boolean
  statusText: string
  activeHitId: string | null
  hasHighlight: boolean
}>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  select: [hit: ReaderSearchHit]
  'clear-highlight': []
  close: []
}>()

const inputRef = ref<HTMLInputElement | null>(null)

const trimmedKeyword = computed(() => props.keyword.trim())
const hasSearched = computed(() => trimmedKeyword.value.length > 0)

/** EPUB 原文中的换行与缩进是排版产物，展示前统一折叠成单个空格。 */
const normalizeExcerpt = (excerpt: string): string => excerpt.replace(/\s+/g, ' ').trim()

/** 把上下文片段按关键词切成若干段，命中的部分用 <mark> 渲染。 */
const buildSegments = (excerpt: string): ExcerptSegment[] => {
  const text = normalizeExcerpt(excerpt)
  const keyword = trimmedKeyword.value

  if (!keyword || !text) {
    return [{ text, matched: false }]
  }

  const lowerText = text.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()
  const segments: ExcerptSegment[] = []
  let cursor = 0

  while (cursor < text.length) {
    const found = lowerText.indexOf(lowerKeyword, cursor)

    if (found === -1) {
      segments.push({ text: text.slice(cursor), matched: false })
      break
    }

    if (found > cursor) {
      segments.push({ text: text.slice(cursor, found), matched: false })
    }

    segments.push({ text: text.slice(found, found + keyword.length), matched: true })
    cursor = found + keyword.length
  }

  return segments
}

const handleInput = (event: Event) => {
  emit('update:keyword', (event.target as HTMLInputElement).value)
}

const handleClearKeyword = () => {
  emit('update:keyword', '')
  inputRef.value?.focus()
}

const handleSelect = (hit: ReaderSearchHit) => {
  emit('select', hit)
}

const handleEnter = () => {
  const firstHit = props.hits[0]
  if (firstHit) {
    emit('select', firstHit)
  }
}

const handleClose = () => {
  emit('close')
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    void nextTick(() => {
      inputRef.value?.focus()
      inputRef.value?.select()
    })
  },
  { immediate: true },
)
</script>

<style scoped>
.search-panel {
  position: fixed;
  top: 38px;
  right: 0;
  left: 0;
  z-index: 4600;
  display: flex;
  flex-direction: column;
  width: min(560px, calc(100vw - 32px));
  max-height: calc(100vh - 56px);
  margin: 0 auto;
  overflow: hidden;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  background: var(--surface-raised);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(14px);
  transform-origin: top center;
  will-change: transform, opacity;
}

.search-panel-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-soft);
}

.search-input-wrap {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
}

.search-input-icon {
  position: absolute;
  left: 11px;
  display: flex;
  color: var(--text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 36px;
  padding: 0 32px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-pill);
  background: var(--surface-card);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
  outline: none;
  transition:
    border-color var(--duration-fast) var(--easing-standard),
    box-shadow var(--duration-fast) var(--easing-standard),
    background-color var(--duration-fast) var(--easing-standard);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-input:focus {
  border-color: var(--border-brand);
  background: var(--surface-strong);
  box-shadow: 0 0 0 3px var(--brand-primary-tint-8);
}

.search-input-clear {
  position: absolute;
  right: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--easing-standard),
    color var(--duration-fast) var(--easing-standard);
}

.search-input-clear:hover {
  background: var(--surface-inset);
  color: var(--text-primary);
}

/* 遮罩层：参考 el-dialog 的点击遮罩关闭，从 titlebar(30px) 下方开始，
   避免挡住窗口控制按钮与 titlebar 图标 */
.search-backdrop {
  position: fixed;
  inset: 30px 0 0;
  z-index: 4599;
  background: transparent;
  cursor: default;
}

.search-backdrop-enter-active,
.search-backdrop-leave-active {
  transition: opacity var(--duration-base) var(--easing-standard);
}

.search-backdrop-enter-from,
.search-backdrop-leave-to {
  opacity: 0;
}

.search-panel-status {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 16px;
  border-bottom: 1px solid var(--border-soft);
  color: var(--text-tertiary);
  font-size: 12px;
}

.search-status-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.search-spinner {
  display: inline-block;
  width: 11px;
  height: 11px;
  border: 2px solid var(--brand-primary-tint-5);
  border-top-color: var(--brand-primary);
  border-radius: 50%;
  animation: search-spinner-rotate 0.7s linear infinite;
}

@keyframes search-spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}

.search-clear-highlight {
  flex-shrink: 0;
  padding: 3px 9px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-pill);
  background: var(--surface-card);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--easing-standard),
    color var(--duration-fast) var(--easing-standard),
    border-color var(--duration-fast) var(--easing-standard);
}

.search-clear-highlight:hover {
  border-color: var(--border-brand);
  background: var(--surface-brand-soft);
  color: var(--brand-primary);
}

.search-panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px;
}

.search-panel-body::-webkit-scrollbar {
  width: 8px;
}

.search-panel-body::-webkit-scrollbar-track {
  background: transparent;
}

.search-panel-body::-webkit-scrollbar-thumb {
  border-radius: 6px;
  background-color: var(--scrollbar-thumb);
  background-clip: content-box;
}

.search-placeholder {
  margin: 0;
  padding: 8px 18px;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.7;
  text-align: center;
}

.search-result-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.search-result-item {
  display: block;
  width: 100%;
  padding: 9px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--easing-standard),
    border-color var(--duration-fast) var(--easing-standard);
}

.search-result-item:hover {
  border-color: var(--border-soft);
  background: var(--surface-card-soft);
}

.search-result-item--active,
.search-result-item--active:hover {
  border-color: var(--border-brand);
  background: var(--surface-brand-soft);
}

.search-result-chapter {
  display: block;
  overflow: hidden;
  margin-bottom: 3px;
  color: var(--brand-primary);
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-result-excerpt {
  display: block;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.65;
  word-break: break-word;
}

.search-result-matched {
  padding: 0 1px;
  border-radius: 3px;
  background: var(--surface-warning-soft-strong);
  color: var(--text-on-warning);
  font-weight: 700;
}

.search-panel-enter-active,
.search-panel-leave-active {
  transition:
    opacity var(--duration-base) var(--easing-standard),
    transform var(--duration-base) var(--easing-standard),
    filter var(--duration-base) var(--easing-standard);
}

.search-panel-enter-from,
.search-panel-leave-to {
  opacity: 0;
  transform: translate3d(0, -14px, 0) scale(0.97);
  filter: blur(4px);
}
</style>
