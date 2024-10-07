<script setup lang="ts">
</script>

<template>
  <div id="app">
    <div class="sidebar">
      <div class="logo">T-Reader</div>
      <nav>
        <ul class="menu">
          <li><router-link to="/">全部图书</router-link></li>
          <li><router-link to="/bookmark">笔记</router-link></li>
        </ul>
      </nav>
    </div>
    <router-view></router-view>
  </div>
</template>

<style scoped>
#app {
  display: flex;
  height: 100vh;
  overflow: hidden; /* 隐藏全局滚动条 */
}

.sidebar {
  flex: 0 0 200px;
}

.main-content {
  flex: 1;
  overflow: auto; /* 仅在内容溢出时显示滚动条 */
}

.sidebar {
  width: 200px;
  background-color: #f4f4f4;
  padding: 20px;
  overflow: hidden;
  /* 隐藏滚动条 */
}

.logo {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
}

.menu {
  list-style: none;
  padding: 0;
}

.menu>li {
  margin-bottom: 10px;
  font-size: 18px;
}

.menu ul {
  list-style: none;
  padding-left: 20px;
}

.menu ul li {
  font-size: 16px;
}
</style>