<template>
    <div class="reader">
      <!-- EPUB 阅读器内容 -->
    </div>
  </template>
  
  <script setup lang="ts">
  import { onMounted } from 'vue';
  import {invoke} from '@tauri-apps/api/core';
  
  onMounted(async () => {
    const bookContent = await invoke('load_book_content');
    // 解析并呈现 EPUB 内容
  });
  </script>
  
  <style>
  /* 样式代码 */
  </style>