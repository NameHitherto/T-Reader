<template>
  <section class="setting-group">
    <div class="setting-card">
      <div v-for="item in contactItems" :key="item.key" class="setting-item contact-setting-item">
        <div class="contact-setting-main">
          <span class="contact-setting-icon" :style="{ color: item.iconColor }">
            <AppIcon :name="item.icon" :size="22" :aria-label="`${item.label} 图标`" />
          </span>
          <div class="setting-item__info">
            <span class="setting-item__title">{{ item.label }}</span>
            <span class="setting-item__subtitle">{{ item.value }}</span>
          </div>
        </div>
        <el-button type="primary" plain @click="openContactTarget(item.label, item.target)">
          {{ item.actionLabel }}
        </el-button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { open } from '@tauri-apps/plugin-shell'
import { computed } from 'vue'
import AppIcon from '@/components/common/AppIcon/index.vue'
import { about } from '@/constants/about'
import type { IconName } from '@/icons/registry'
import { showMainTaskMessage } from '@/services/notification'
import { toHttpResponseMessage } from '@/services/response'

interface ContactItem {
  key: string
  label: string
  value: string
  actionLabel: string
  target: string
  icon: IconName
  iconColor: string
}

const contactItems = computed<ContactItem[]>(() => [
  {
    key: 'bilibili',
    label: 'Bilibili',
    value: about.contact.bilibili,
    actionLabel: '打开主页',
    target: about.contact.bilibili,
    icon: 'contactBilibili',
    iconColor: '#00aeec',
  },
  {
    key: 'github',
    label: 'GitHub',
    value: about.contact.github,
    actionLabel: '打开主页',
    target: about.contact.github,
    icon: 'contactGithub',
    iconColor: '#24292f',
  },
  {
    key: 'email',
    label: '邮箱',
    value: about.contact.email,
    actionLabel: '发送邮件',
    target: `mailto:${about.contact.email}`,
    icon: 'contactEmail',
    iconColor: 'var(--brand-primary)',
  },
])

const openContactTarget = async (label: string, target: string) => {
  try {
    await open(target)
  } catch (error) {
    showMainTaskMessage({
      type: 'error',
      title: `打开${label}失败`,
      message: toHttpResponseMessage(error),
      taskKey: `about-contact-${label}`,
    })
  }
}
</script>

<style scoped lang="scss">
@use './setting-tab';

.contact-setting-item {
  align-items: center;

  :deep(.el-button) {
    flex: 0 0 auto;
  }
}

.contact-setting-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.contact-setting-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--surface-card-soft);
  box-shadow: var(--shadow-sm);
}

@media (max-width: 560px) {
  .contact-setting-item {
    align-items: stretch;
    flex-direction: column;

    :deep(.el-button) {
      width: 100%;
    }
  }
}
</style>
