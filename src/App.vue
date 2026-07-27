<template>
  <Teleport to="#titlebar-page-title">
    <span class="main-titlebar-page-name">{{ pageTitle }}</span>
  </Teleport>

  <div class="app-shell">
    <aside class="sidebar" aria-label="主导航">
      <div class="logo">
        <div class="logo-icon">
          <img :src="logoIcon" alt="T-Reader" />
        </div>
        <span>T-Reader</span>
      </div>

      <nav class="sidebar-navigation">
        <ul class="menu menu--primary">
          <li v-for="item in primaryNavigation" :key="item.name">
            <RouterLink
              :to="item.path"
              class="menu-item"
              :class="{ active: route.name === item.name }"
            >
              <AppIcon :name="item.icon" :size="22" />
              <span class="menu-label">{{ item.label }}</span>
            </RouterLink>
          </li>
        </ul>

        <ul class="menu menu--utility">
          <li v-for="item in utilityNavigation" :key="item.name">
            <RouterLink
              :to="item.path"
              class="menu-item"
              :class="{ active: route.name === item.name }"
            >
              <AppIcon :name="item.icon" :size="22" />
              <span class="menu-label">{{ item.label }}</span>
            </RouterLink>
          </li>
        </ul>
      </nav>
    </aside>

    <main class="app-view">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import logoIcon from '/src-tauri/icons/Roxy.png'
import AppIcon from '@/components/common/AppIcon/index.vue'
import { WINDOW_EVENTS } from '@/constants/events'
import { IconName } from '@/icons/registry'
import { showMainTaskMessage } from '@/services/notification/mainTaskMessageService'
import { logWarn } from '@/utils/logger'

interface NavigationItem {
  name: string
  path: string
  label: string
  icon: IconName
}

const route = useRoute()

const primaryNavigation: NavigationItem[] = [
  { name: 'Home', path: '/', label: '书架', icon: 'sidebarBookshelf' },
  { name: 'Bookmark', path: '/bookmark', label: '笔记', icon: 'sidebarNote' },
  { name: 'Sync', path: '/sync', label: '云同步', icon: 'refresh' },
]

const utilityNavigation: NavigationItem[] = [
  { name: 'Settings', path: '/settings', label: '设置', icon: 'setting' },
  { name: 'About', path: '/about', label: '关于', icon: 'sidebarAbout' },
]

const pageTitle = computed(() => String(route.meta.title ?? 'T-Reader'))

let unlistenCloudSyncFailed: UnlistenFn | null = null

const registerCloudSyncFailedListener = async () => {
  unlistenCloudSyncFailed?.()
  unlistenCloudSyncFailed = await listen(WINDOW_EVENTS.CLOUD_SYNC_FAILED, () => {
    showMainTaskMessage({
      type: 'warning',
      title: '云同步失败',
      message: '阅读进度已保存至本地，但云端同步失败，请检查网络连接。',
      taskKey: 'main-cloud-sync-failed',
    })
  })
}

onMounted(() => {
  void registerCloudSyncFailedListener().catch((error) => {
    logWarn('app-shell', 'register cloud-sync-failed listener failed', error)
  })
})

onUnmounted(() => {
  unlistenCloudSyncFailed?.()
  unlistenCloudSyncFailed = null
})
</script>

<style lang="scss" scoped>
.app-shell {
  display: flex;
  height: calc(100vh - var(--main-titlebar-height));
  margin-top: var(--main-titlebar-height);
  overflow: hidden;
  color: var(--text-primary);
}

.sidebar {
  position: relative;
  z-index: 2;
  display: flex;
  flex: 0 0 var(--main-sidebar-width);
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  user-select: none;
  background: var(--surface-strong);
  border-right: 1px solid var(--border-soft);
}

.logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 18px 10px 14px;
  color: var(--text-tertiary);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.logo-icon {
  width: 44px;
  height: 44px;
  padding: 3px;
  overflow: hidden;
  background: var(--surface-logo-gradient);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);

  img {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 9px;
  }
}

.sidebar-navigation {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 4px 10px 12px;
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.menu--utility {
  padding-top: 12px;
  margin-top: auto;
  border-top: 1px solid var(--border-soft);
}

.menu-item {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 42px;
  gap: 6px;
  padding: 0 7px;
  color: var(--text-secondary);
  text-decoration: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: var(--t-mouse-cursor-link), pointer;
  transition:
    color var(--duration-fast) var(--easing-standard),
    border-color var(--duration-fast) var(--easing-standard),
    background-color var(--duration-fast) var(--easing-standard),
    box-shadow var(--duration-fast) var(--easing-standard);

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

    .menu-label {
      font-weight: 700;
    }
  }
}

.menu-label {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-view {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.main-titlebar-page-name {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.015em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
