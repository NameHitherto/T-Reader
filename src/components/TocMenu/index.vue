<template>
    <el-sub-menu :index="subToc.id || subToc.href">
        <template #title>
            <span>{{ subToc.label }}</span>
        </template>
        <template v-for="item in subToc.subitems">
            <toc-menu 
                v-if="item.subitems.length > 0" 
                :subToc="item"
            />
            <el-menu-item v-else :key="item.id" :index="item.href">
                {{ item.label }}
            </el-menu-item>
        </template>
    </el-sub-menu>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({
    name: 'TocMenu',
    props: {
        subToc: {
            type: Object as any,
            required: true
        }
    }
})
</script>