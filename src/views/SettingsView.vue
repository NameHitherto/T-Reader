<template>
  <div class="settings-page">
    <aside class="settings-tab-nav" aria-label="设置分类">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="settings-tab-item"
        :class="{ active: activeTab === tab.id }"
        @click="selectTab(tab.id)"
      >
        <AppIcon :name="tab.icon" :size="18" />
        <span class="settings-tab-item__label">{{ tab.label }}</span>
      </button>
    </aside>

    <div class="settings-content-view">
      <header class="settings-content-header">
        <h2 class="settings-content-header__title">{{ activeTabMeta.label }}</h2>
        <span class="settings-content-header__desc">{{ activeTabMeta.description }}</span>
      </header>
      <div class="settings-page-scroll">
        <div class="settings-content">
          <component :is="activeTabMeta.component" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GeneralSettings from '@/components/SettingTabs/GeneralSettings.vue'
import NetworkSettings from '@/components/SettingTabs/NetworkSettings.vue'
import AiModelSettings from '@/components/SettingTabs/AiModelSettings.vue'
import TxtTocSettings from '@/components/SettingTabs/TxtTocSettings.vue'
import UpdateSettings from '@/components/SettingTabs/UpdateSettings.vue'
import ContactSettings from '@/components/SettingTabs/ContactSettings.vue'
import AppIcon from '@/components/common/AppIcon/index.vue'
import { useSettingsCenter } from '@/composables/useSettingsCenter'
import type { IconName } from '@/icons/registry'

interface SettingsTab {
  id: string
  label: string
  description: string
  icon: IconName
  component: Component
}

// 左侧导航仅包含模块大类，具体配置项由各分类子标签页（SettingTabs）自行维护
const tabs: SettingsTab[] = [
  {
    id: 'general',
    label: '通用',
    description: '基本行为设置',
    icon: 'setting',
    component: GeneralSettings,
  },
  {
    id: 'network',
    label: '网络',
    description: '云同步与网络代理设置',
    icon: 'globe',
    component: NetworkSettings,
  },
  {
    id: 'aiModels',
    label: 'AI大模型',
    description: '配置对话 / 图像 / 嵌入 / 重排序模型服务',
    icon: 'robot',
    component: AiModelSettings,
  },
  {
    id: 'txtToc',
    label: 'TXT分章规则',
    description: '正则匹配章节标题',
    icon: 'sortList',
    component: TxtTocSettings,
  },
  {
    id: 'update',
    label: '检查更新',
    description: '版本信息与更新',
    icon: 'refresh',
    component: UpdateSettings,
  },
  {
    id: 'contact',
    label: '联系作者',
    description: '问题反馈与联系方式',
    icon: 'contactEmail',
    component: ContactSettings,
  },
]

const route = useRoute()
const router = useRouter()
const { loadSettings, flushAutoSaveSettings } = useSettingsCenter()

const activeTab = ref('general')

const activeTabMeta = computed(() => {
  return tabs.find((tab) => tab.id === activeTab.value) ?? tabs[0]
})

const syncActiveTabFromRoute = () => {
  const rawTab = route.query.module
  const tabId = Array.isArray(rawTab) ? rawTab[0] : rawTab
  const nextTab = tabs.some((tab) => tab.id === tabId) ? String(tabId) : 'general'

  if (nextTab !== activeTab.value) {
    activeTab.value = nextTab
  }
}

const selectTab = (tabId: string) => {
  if (!tabs.some((tab) => tab.id === tabId) || activeTab.value === tabId) {
    return
  }

  activeTab.value = tabId
  void router.replace({ query: { module: tabId } })
}

watch(() => route.query.module, syncActiveTabFromRoute)

onMounted(() => {
  syncActiveTabFromRoute()
  void loadSettings()
})

onBeforeUnmount(() => {
  void flushAutoSaveSettings()
})
</script>

<style scoped lang="scss">
.settings-page {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  color: var(--text-primary);
  background: var(--app-bg-accent);
}

.settings-tab-nav {
  display: flex;
  flex: 0 0 200px;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 16px 10px 20px;
  overflow-y: auto;
  background: var(--surface-strong);
  border-right: 1px solid var(--border-soft);
}

.settings-tab-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 42px;
  padding: 0 12px;
  color: var(--text-secondary);
  font-size: 14px;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--easing-standard),
    background-color var(--duration-fast) var(--easing-standard),
    border-color var(--duration-fast) var(--easing-standard),
    box-shadow var(--duration-fast) var(--easing-standard);

  // 激活项右侧竖向强调条
  &::before {
    position: absolute;
    top: 11px;
    bottom: 11px;
    right: 4px;
    width: 3px;
    content: '';
    background: transparent;
    border-radius: var(--radius-pill);
  }

  &:hover {
    color: var(--brand-primary);
    background: var(--surface-brand-soft);
    border-color: var(--border-brand);
  }

  &.active {
    color: var(--brand-primary);
    background: var(--surface-brand-soft);
    border-color: var(--border-brand);
    box-shadow: inset 0 0 0 1px var(--ring-brand-subtle);

    &::before {
      background: var(--brand-primary);
    }

    .settings-tab-item__label {
      font-weight: 700;
    }
  }
}

.settings-tab-item__label {
  min-width: 0;
  overflow: hidden;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-content-view {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.settings-content-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 16px 0 16px 32px;
  border-bottom: 1px solid var(--border-soft);

  &__title {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
  }

  &__desc {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-tertiary);
  }
}

.settings-page-scroll {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: var(--t-scrollbar-width-thin);
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: var(--radius-pill);
  }
}

.settings-content {
  width: min(920px, 100%);
  margin: 0 auto;
  padding: 24px 24px 24px;
}

@media (max-width: 720px) {
  .settings-tab-nav {
    flex-basis: 160px;
    padding: 12px 8px 16px;
  }

  .settings-content {
    padding: 18px 16px;
  }
}
</style>
