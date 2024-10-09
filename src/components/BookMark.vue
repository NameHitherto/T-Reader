<template>
    <div class="bookmark" @contextmenu="onContextMenu">
      <h1>BookMark Component</h1>
      <MenuComponent/>
    </div>
  </template>
  
  <script lang="ts">
  import { defineComponent } from 'vue';
  import ContextMenu from '@imengyu/vue3-context-menu';
  import MenuComponent from './MenuComponent.vue';
  
  export default defineComponent({
    name: 'BookMark',
    components: {
      MenuComponent
    },
    methods: {
      onContextMenu(e: MouseEvent) {
        e.preventDefault();
        ContextMenu.showContextMenu({
          x: e.x,
          y: e.y,
          items: [
            { 
              label: "打开", 
              onClick: () => {
                alert("你点击了打开");
              }
            },
            { 
              label: "删除", 
              onClick: () => {
                alert("你点击了删除");
              }
            },
          ]
        });
      }
    }
  });
  </script>
  
  <style scoped>
  </style>