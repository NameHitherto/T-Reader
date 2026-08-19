<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="markdown-body" v-html="rendered"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/utils/markdown'

const props = defineProps<{
  content: string
}>()

const rendered = computed(() => renderMarkdown(props.content))
</script>

<style lang="scss" scoped>
.markdown-body {
  white-space: normal;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.7;

  :deep(> :first-child) {
    margin-top: 0;
  }

  :deep(> :last-child) {
    margin-bottom: 0;
  }

  :deep(p),
  :deep(ul),
  :deep(ol),
  :deep(blockquote),
  :deep(pre),
  :deep(table) {
    margin: 8px 0;
  }

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    margin: 14px 0 8px;
    font-weight: 700;
    line-height: 1.4;
  }

  :deep(h1) {
    font-size: 18px;
  }

  :deep(h2) {
    font-size: 16px;
  }

  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    font-size: 15px;
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 22px;
  }

  :deep(a) {
    color: var(--brand-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  :deep(code) {
    padding: 2px 6px;
    font-family: var(--font-family-mono);
    font-size: 13px;
    background: var(--surface-code-inline);
    border-radius: 4px;
  }

  :deep(pre) {
    padding: 10px 12px;
    overflow-x: auto;
    background: var(--surface-code);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-sm);

    code {
      padding: 0;
      font-size: 13px;
      line-height: 1.6;
      background: transparent;
      border-radius: 0;
    }
  }

  :deep(blockquote) {
    padding: 2px 12px;
    color: var(--text-secondary);
    border-left: 3px solid var(--border-brand);
  }

  :deep(table) {
    border-collapse: collapse;
    width: 100%;
    font-size: 13px;
  }

  :deep(th),
  :deep(td) {
    padding: 6px 10px;
    border: 1px solid var(--border-default);
  }

  :deep(th) {
    background: var(--surface-card-muted);
    font-weight: 700;
  }

  :deep(hr) {
    margin: 12px 0;
    border: none;
    border-top: 1px solid var(--border-soft);
  }

  // highlight.js token 配色：使用主题变量，自动适配明暗主题
  :deep(.hljs-keyword),
  :deep(.hljs-selector-tag),
  :deep(.hljs-built_in) {
    color: var(--brand-primary);
  }

  :deep(.hljs-string),
  :deep(.hljs-attr),
  :deep(.hljs-symbol) {
    color: var(--text-success);
  }

  :deep(.hljs-number),
  :deep(.hljs-literal) {
    color: var(--brand-secondary);
  }

  :deep(.hljs-comment),
  :deep(.hljs-quote) {
    color: var(--text-tertiary);
    font-style: italic;
  }

  :deep(.hljs-title),
  :deep(.hljs-name),
  :deep(.hljs-section) {
    color: var(--brand-primary-strong);
    font-weight: 600;
  }

  :deep(.hljs-type),
  :deep(.hljs-class) {
    color: var(--brand-secondary-strong);
  }
}
</style>
