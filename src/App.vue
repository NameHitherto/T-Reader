<script setup lang="ts">
import Sidebar from "./components/Sidebar.vue";
import MainContent from "./components/MainContent.vue";
</script>

<template>
  <div id="app">
    <Sidebar />
    <MainContent />
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
</style>