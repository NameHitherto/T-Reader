<template>
  <el-sub-menu :index="subToc.href || subToc.id">
    <template #title>
      <span>{{ subToc.label }}</span>
    </template>
    <template v-for="item in subToc.subitems || []" :key="item.id || item.href">
      <toc-menu v-if="item.subitems?.length" :sub-toc="item" />
      <el-menu-item v-else :key="item.id" :index="item.href">
        {{ item.label }}
      </el-menu-item>
    </template>
  </el-sub-menu>
</template>
<script lang="ts">
import { defineComponent, PropType } from 'vue'
import type { EpubTocItem } from '@/types/epub'

export default defineComponent({
  name: 'TocMenu',
  props: {
    subToc: {
      type: Object as PropType<EpubTocItem>,
      required: true,
    },
  },
})
</script>
