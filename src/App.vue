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
          <li :class="{active: currentView === 'Home'}">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              :width="svgSize"
              :height="svgSize"
              viewBox="0 0 48 48"
            >
              <path
                fill="none"
                :stroke="currentView === 'Home' ? '#409eff' : '#000000'"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="4"
                d="M5 6h34s4 2 4 7s-4 7-4 7H5s4-2 4-7s-4-7-4-7m38 22H9s-4 2-4 7s4 7 4 7h34s-4-2-4-7s4-7 4-7"
              />
            </svg>
            <router-link @click="changeView('Home')" to="/">书架</router-link>
          </li>
          <li :class="{active: currentView === 'Bookmark'}">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              :width="svgSize"
              :height="svgSize"
              viewBox="0 0 24 24"
            >
              <path
                :fill="currentView === 'Bookmark' ? '#409eff' : '#000000'"
                d="M17 2H9C7.346 2 6 3.346 6 5v14c0 .514.104.946.308 1.285c.564.935 1.815 1.008 2.813.008l3.172-3.172a1.03 1.03 0 0 1 1.414 0l3.172 3.172c.491.491 1.002.74 1.52.74c.797 0 1.601-.629 1.601-2.033V5c0-1.654-1.346-3-3-3M9 4h8c.551 0 1 .449 1 1v9.905l-2.451-2.247c-1.406-1.289-3.693-1.288-5.099 0L8 14.905V5c0-.551.449-1 1-1m6.121 11.707c-.565-.565-1.318-.876-2.121-.876s-1.556.312-2.121.876L8 18.586v-2.324l3.126-2.866c1.033-.947 2.714-.947 3.747 0L18 16.262v2.324z"
              />
            </svg>
            <router-link @click="changeView('Bookmark')" to="/bookmark">笔记</router-link>
          </li>
          <li :class="{active: currentView === 'About'}">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              :width="svgSize"
              :height="svgSize"
              viewBox="0 0 24 24"
            >
              <path
                :fill="currentView === 'About' ? '#409eff' : '#000000'"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
              />
            </svg>
            <router-link @click="changeView('About')" to="/about">关于</router-link>
          </li>
          <li :class="{active: currentView === 'Experiment'}">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              :width="svgSize"
              :height="svgSize"
              viewBox="0 0 48 48"
            >
              <g fill="none" :stroke="currentView === 'Experiment' ? '#409eff' : '#000000'" stroke-width="4">
                <path stroke-linecap="round" d="M12 4h24" />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m10.777 30l7.242-14.961V4h12.01v11.039L37.245 30"
                />
                <path
                  stroke-linejoin="round"
                  d="M7.794 43.673a3.273 3.273 0 0 1-1.52-4.372L10.777 30S18 35 24 30s13.246 0 13.246 0l4.49 9.305A3.273 3.273 0 0 1 38.787 44H9.22c-.494 0-.981-.112-1.426-.327Z"
                />
              </g>
            </svg>
            <router-link @click="changeView('Experiment')" to="/experiment">更多</router-link>
          </li>
        </ul>
      </nav>
    </div>
    <router-view></router-view>
  </div>
</template>
<script lang="ts">
import logoIcon from '/src-tauri/icons/Roxy.png'

export default {
  name: 'App',
  data() {
    return {
      logoIcon,
      currentView: '',
      svgSize: 24,
    }
  },
  methods: {
    changeView(view: string) {
      this.currentView = view
    }
  },
  watch: {
    $route(to) {
      this.currentView = to.name
    }
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
        align-items: center;
        padding: 8px;
        border-radius: 8px;
        border: transparent 1.5px solid;

        a {
          text-decoration: none;
          flex: 1;
          color: #000000;
        }

        &:hover {
          border-color: var(--t-color-light-yellow);
          border-style: dashed;

          a {
            color: #409eff;
          }
        }
      }

      .active {
        background: var(--t-color-slight-blue);

        a {
          color: #409eff;
          font-weight: bold;
        }
      }

      li:nth-child(1):hover {
        svg{
          path {
            stroke: #409eff;
          }
        }
      }
      li:nth-child(2):hover {
        svg{
          path {
            fill: #409eff;
          }
        }
      }
      li:nth-child(3):hover {
        svg{
          g {
            stroke: #409eff;
          }
        }
      }
    }
  }
}
</style>
