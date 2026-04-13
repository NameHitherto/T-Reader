<template>
  <div id="app" class="app-shell">
    <div class="sidebar">
      <div class="logo">
        <div class="logo-icon">
          <img :src="logoIcon" />
        </div>
        <span>T-Reader</span>
      </div>
      <nav>
        <ul class="menu">
          <li :class="{active: currentView === 'Home'}" @click="navigate('Home', '/')">
            <AppIcon name="sidebarBookshelf" :size="24" />
            <span class="menu-label">书架</span>
          </li>
          <li :class="{active: currentView === 'Bookmark'}" @click="navigate('Bookmark', '/bookmark')">
            <AppIcon name="sidebarNote" :size="24" />
            <span class="menu-label">笔记</span>
          </li>
          <li :class="{active: currentView === 'About'}" @click="navigate('About', '/about')">
            <AppIcon name="sidebarAbout" :size="24" />
            <span class="menu-label">关于</span>
          </li>
          <li :class="{active: currentView === 'Experiment'}" @click="navigate('Experiment', '/experiment')">
            <AppIcon name="sidebarMore" :size="24" />
            <span class="menu-label">更多</span>
          </li>
        </ul>
      </nav>
    </div>
    <router-view></router-view>
  </div>
</template>
<script lang="ts">
import logoIcon from '/src-tauri/icons/Roxy.png'
import AppIcon from '@/components/common/AppIcon/index.vue'

export default {
  name: 'App',
  components: {
    AppIcon,
  },
  data() {
    return {
      logoIcon,
      currentView: '',
    }
  },
  methods: {
    changeView(view: string) {
      this.currentView = view
    },
    navigate(view: string, path: string) {
      this.changeView(view)
      if (this.$route.path !== path) {
        this.$router.push(path)
      }
    }
  },
  watch: {
    $route(to) {
      this.currentView = to.name
    }
  },
  mounted() {
    this.currentView = this.$route.name as string
  }
}
</script>
<style scoped>
#app {
  display: flex;
  height: 100vh;
  overflow: hidden;
  color: var(--text-primary);

  .sidebar {
    flex: 0 0 120px;
    user-select: none;
    background: var(--surface-strong);
    border-right: 1px solid var(--border-soft);
    overflow: hidden;
    backdrop-filter: blur(12px);

    .logo {
      display: flex;
      flex-direction: column;
      font-size: 24px;
      font-weight: bold;
      margin: 20px 0;
      align-items: center;
      color: var(--text-primary);

      .logo-icon {
        width: 64px;
        height: 64px;
        border: 1px solid var(--border-default);
        background: var(--surface-logo-gradient);
        border-radius: 15px;
        padding: 4px;
        box-shadow: var(--shadow-sm);

        img {
          width: 100%;
          height: 100%;
          border-radius: 14px;
        }
      }

      span {
        text-align: center;
        font-size: 22px;
        color: var(--text-tertiary);
      }
    }

    .menu {
      display: flex;
      flex-direction: column;
      list-style: none;
      margin: 0 12px;
      padding: 0;

      li {
        display: flex;
        gap: 10px;
        margin-bottom: 8px;
        font-size: 18px;
        color: var(--text-secondary);
        align-items: center;
        padding: 8px;
        border-radius: var(--radius-sm);
        border: 1px solid transparent;
        cursor: var(--t-mouse-cursor-link), pointer;
        transition:
          color var(--duration-fast) var(--easing-standard),
          border-color var(--duration-fast) var(--easing-standard),
          background-color var(--duration-fast) var(--easing-standard),
          transform var(--duration-fast) var(--easing-standard);

        .menu-label {
          flex: 1;
          color: inherit;
        }

        &:hover {
          transform: translateX(2px);
          border-color: var(--border-brand);
          background: var(--surface-brand-soft);
          color: var(--brand-primary);
        }
      }

      .active {
        background: var(--surface-brand-soft);
        color: var(--brand-primary);
        box-shadow: inset 0 0 0 1px var(--ring-brand-subtle);

        .menu-label {
          font-weight: bold;
        }
      }
    }
  }
}
</style>
