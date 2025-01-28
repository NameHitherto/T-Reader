<template>
    <div class="tag-item">
        <div v-if="!isFirst" class="tag-tail-left"></div>
        <div v-if="!isLast" class="tag-tail-right"></div>
        <div class="tag-node"></div>
        <div class="tag-link"></div>
        <div class="tag-body">
            <span class="tag-content">{{ bookMark.content }}</span>
            <span class="tag-comment">{{ bookMark.comments }}</span>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { BookMark } from '@/store/bookMark';
export default defineComponent({
  name: 'BookMarkTag',
  props: {
    isFirst: {
        type: Boolean,
        default: false
    },
    isLast: {
        type: Boolean,
        default: false
    },
    bookMark: {
        type: Object as () => BookMark,
        required: true
    }
  },
  components: {
    
  },
  data() {
    return {
    }
  },
  computed: {
  },
  watch: {
  },
  methods: {
    
  },
})
</script>
<style lang="scss" scoped>
.tag {
    &-item {
        position: relative;
        width: 180px;
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    &-tail-left {
        position: absolute;
        width: 50%;
        top: 8px;
        left: 0;
        border-top: 2px dashed #ccc;
    }
    &-tail-right {
        position: absolute;
        width: 50%;
        top: 8px;
        left: 50%;
        border-top: 2px dashed #ccc;
    }
    &-node {
        width: 16px;
        height: 16px;
        background-color: var(--t-color-light-grey);
        border-radius: 50%;
        border-color: var(--t-color-light-grey);
        z-index: 1;
    }
    &-link {
        width: 3px;
        height: 20px;
        background-color: var(--t-color-light-grey);
    }
    &-body {
        position: relative;
        width: 100px;
        height: 400px;
        display: inline-flex;
        justify-content: center;
        font-size: 18px;
        padding: 10px 0;
        border: var(--t-border-medium-grey);
        border-radius: 10px;

        .tag-content {
            writing-mode: vertical-lr;
            width: 3.6em;
            line-height: 1.2em;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            user-select: none;
        }

        .tag-comment {
            writing-mode: vertical-lr;
            opacity: 0;
            position: absolute;
            top: 10px;
            max-width: 150px;
            height: 90%;
            color: #fff;
            line-height: 1.1em;
            min-width: 3.3em;
            border-radius: 6px;
            padding: 0.5em 0;
            transition: all .3s ease-in-out;
            box-shadow: #b3b3b3 0px 0px 5px 3px;
        }

        &:hover {
            .tag-comment {
                opacity: 1;
                background-color: #000;
            }
        }
    }
}
</style>