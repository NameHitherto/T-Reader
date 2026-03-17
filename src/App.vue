<template>
  <div id="app">
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
  overflow: hidden; /* 隐藏全局滚动条 */

  .sidebar {
    flex: 0 0 120px;
    user-select: none;
    background-color: #ffffff;
    overflow: hidden;

    .logo {
      display: flex;
      flex-direction: column;
      font-size: 24px;
      font-weight: bold;
      margin: 20px 0;
      align-items: center;

      .logo-icon {
        width: 64px;
        height: 64px;
        border: 2px solid #e8e8e8;
        background: antiquewhite;
        border-radius: 15px;

        img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
        }
      }

      span {
        text-align: center;
        font-size: 22px;
        color: var(--t-color-grey);
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
        color: #515154;
        align-items: center;
        padding: 8px;
        border-radius: 8px;
        border: transparent 1.5px solid;
        cursor: var(--t-mouse-cursor-link), pointer;
        transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;

        .menu-label {
          flex: 1;
          color: inherit;
        }

        &:hover {
          border-color: var(--t-color-light-yellow);
          border-style: dashed;
          color: #007aff;
        }
      }

      .active {
        background: var(--t-color-slight-blue);
        color: #007aff;

        .menu-label {
          font-weight: bold;
        }
      }
    }
  }
}
</style>
