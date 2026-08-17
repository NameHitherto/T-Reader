<template>
  <!-- TXT分章规则 -->
  <section class="setting-group">
    <div class="setting-card">
      <div v-if="txtTocRules.length === 0" class="txt-toc-rule-empty">暂无可展示规则</div>
      <div v-else class="txt-toc-rule-list">
        <article
          v-for="(rule, index) in txtTocRules"
          :key="rule.id"
          class="setting-item txt-toc-rule"
        >
          <div class="txt-toc-rule__priority">
            <button
              type="button"
              class="txt-toc-rule__order-btn"
              title="上移优先级"
              :disabled="index === 0"
              @click="moveTxtTocRule(index, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="txt-toc-rule__order-btn"
              title="下移优先级"
              :disabled="index === txtTocRules.length - 1"
              @click="moveTxtTocRule(index, 1)"
            >
              ↓
            </button>
          </div>

          <div class="txt-toc-rule__content">
            <div class="txt-toc-rule__header">
              <span class="txt-toc-rule__name">{{ rule.name }}</span>
              <el-switch v-model="rule.enable" size="small" />
            </div>
            <div class="txt-toc-rule__field">
              <span class="txt-toc-rule__label">样例</span>
              <p class="txt-toc-rule__example">{{ rule.example }}</p>
            </div>
            <div class="txt-toc-rule__field">
              <span class="txt-toc-rule__label">规则</span>
              <pre class="txt-toc-rule__regex">{{ rule.rule }}</pre>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useSettingsCenter } from '@/composables/useSettingsCenter'

const { txtTocRules, moveTxtTocRule } = useSettingsCenter()
</script>

<style scoped lang="scss">
@use './setting-tab';

.txt-toc-rule-empty {
  padding: 14px 0;
  color: var(--text-tertiary);
  font-size: 13px;
}

.txt-toc-rule-list {
  display: flex;
  flex-direction: column;
}

.txt-toc-rule {
  align-items: flex-start;
  justify-content: flex-start;

  &__priority {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 2px;
  }

  &__order-btn {
    width: 28px;
    height: 28px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-card);
    color: var(--text-primary);
    cursor: pointer;
    transition:
      border-color var(--duration-fast) var(--easing-standard),
      background-color var(--duration-fast) var(--easing-standard);

    &:hover:not(:disabled) {
      border-color: var(--border-brand);
      background: var(--surface-brand-soft);
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }

  &__content {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__name {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  &__label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-tertiary);
  }

  &__example {
    margin: 0;
    font-size: 12px;
    color: var(--text-tertiary);
    word-break: break-word;
  }

  &__regex {
    margin: 0;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-soft);
    background: var(--surface-card-soft);
    color: var(--text-primary);
    font-size: 12px;
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
