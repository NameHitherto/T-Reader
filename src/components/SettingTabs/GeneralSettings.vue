<template>
  <!-- 通用 -->
  <section class="setting-group">
    <h3 class="setting-group__title">界面主题</h3>
    <div class="setting-card">
      <div class="setting-item">
        <div class="setting-item__info">
          <span class="setting-item__title">黑夜模式</span>
          <span class="setting-item__subtitle">开启后切换为深色视觉主题</span>
        </div>
        <el-switch
          :model-value="themeMode === 'dark'"
          class="theme-switch"
          :aria-label="themeMode === 'dark' ? '切换到白天模式' : '切换到黑夜模式'"
          @change="onThemeSwitchChange"
        >
          <template #active-action>
            <AppIcon name="moon" :size="14" />
          </template>
          <template #inactive-action>
            <AppIcon name="sun" :size="14" />
          </template>
        </el-switch>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import AppIcon from '@/components/common/AppIcon/index.vue'
import { useSettingsCenter } from '@/composables/useSettingsCenter'

const { themeMode } = useSettingsCenter()

const onThemeSwitchChange = (value: string | number | boolean) => {
  themeMode.value = value ? 'dark' : 'light'
}
</script>

<style scoped lang="scss">
@use './setting-tab';

// 主题 Switch（基于 el-switch，带日/月图标）
.theme-switch {
  --el-switch-on-color: var(--brand-primary);
  --el-switch-off-color: var(--surface-inset);
  flex-shrink: 0;

  :deep(.el-switch__core) {
    min-width: 48px;
    height: 26px;
    border-radius: var(--radius-pill);
  }

  :deep(.el-switch__action) {
    width: 22px;
    height: 22px;
    background: #ffffff;
    color: var(--brand-secondary);
    box-shadow: var(--shadow-sm);
  }

  &.is-checked :deep(.el-switch__action) {
    left: calc(100% - 23px);
    color: var(--brand-primary);
  }
}
</style>
