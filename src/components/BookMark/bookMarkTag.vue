<template>
  <div class="tag-item">
    <div v-if="!isFirst" class="tag-tail-left"></div>
    <div v-if="!isLast" class="tag-tail-right"></div>
    <div class="tag-node"></div>
    <div class="tag-link"></div>

    <div class="tag-body" @click="handleOptions">
      <div class="tag-inner">
        <div class="front">
          <div class="tag-hole"></div>
          <div class="tag-content">{{ bookMark.content }}</div>
        </div>
        <div class="back">
          <div class="tag-hole"></div>
          <div class="tag-comment" :class="bookMark.comments ? 'primary' : 'info'">
            {{ bookMark.comments ? bookMark.comments : '你还未对此作出评价' }}
          </div>
        </div>
      </div>

      <!-- 胶囊操作栏：默认隐藏，点击书签体展开 / 收起 -->
      <div class="action-dock">
        <el-tooltip content="跳转阅读" effect="light" placement="right" :show-after="150">
          <button class="dock-btn jump-btn" aria-label="跳转阅读" @click.stop="jumpToRead">
            <svg
              class="dock-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>
        </el-tooltip>

        <el-tooltip content="删除此笔记" effect="light" placement="right" :show-after="150">
          <button class="dock-btn delete-btn" aria-label="删除笔记" @click.stop="deleteBookMark">
            <svg
              class="dock-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </el-tooltip>

        <el-tooltip content="标为重要" effect="light" placement="right" :show-after="150">
          <button
            class="dock-btn star-btn"
            :class="{ 'is-starred': isStarred }"
            aria-label="标为重要"
            @click.stop="toggleStar"
          >
            <svg
              class="dock-icon"
              viewBox="0 0 24 24"
              :fill="isStarred ? 'currentColor' : 'none'"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
              ></polygon>
            </svg>
          </button>
        </el-tooltip>
      </div>
    </div>

    <div class="tag-footer">
      <span class="tag-time">{{ bookMark.createTime }}</span>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { BookMark } from '@/store/bookMark'

export default defineComponent({
  name: 'BookMarkTag',
  components: {},
  props: {
    isFirst: {
      type: Boolean,
      default: false,
    },
    isLast: {
      type: Boolean,
      default: false,
    },
    bookMark: {
      type: Object as () => BookMark,
      required: true,
    },
  },
  emits: ['jump', 'delete'],
  data() {
    return {
      // 标为重要：仅组件内视觉状态，不持久化（与既有行为一致）
      isStarred: false,
    }
  },
  computed: {},
  watch: {},
  mounted() {
    // 添加过渡动画
    this.$el.classList.add('tag-fade-in')
    // 定时删除过渡动画
    setTimeout(() => {
      this.$el.classList.remove('tag-fade-in')
    }, 500)
  },
  methods: {
    handleOptions(event: MouseEvent) {
      // 点击书签体：展开 / 收起当前操作栏，并互斥收起其他书签的操作栏
      const target = event.currentTarget as HTMLElement
      const dock = target.querySelector('.action-dock')
      if (!dock) {
        return
      }

      const isShown = dock.classList.contains('show')
      document.querySelectorAll('.action-dock').forEach((item) => {
        item.classList.remove('show')
      })

      if (!isShown) {
        dock.classList.add('show')
      }
    },
    jumpToRead() {
      // 跳转到笔记处
      this.$emit('jump')
    },
    deleteBookMark() {
      // 删除此笔记
      this.$emit('delete')
    },
    toggleStar() {
      // 切换"标为重要"视觉状态
      this.isStarred = !this.isStarred
    },
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
    border-top: 2px dashed var(--bookmark-paper-node-border);
  }
  &-tail-right {
    position: absolute;
    width: 50%;
    top: 8px;
    left: 50%;
    border-top: 2px dashed var(--bookmark-paper-node-border);
  }
  &-node {
    width: 16px;
    height: 16px;
    background: var(--bookmark-paper-front);
    border-radius: 50%;
    border: 2px solid var(--bookmark-paper-ring);
    z-index: 1;
  }
  &-link {
    width: 3px;
    height: 20px;
    background-color: var(--bookmark-paper-line);
  }
  &-body {
    width: 100px;
    height: 400px;
    justify-content: center;
    font-size: 18px;
    backdrop-filter: blur(2px);
    cursor: var(--t-mouse-cursor-link), default;
    background-color: transparent;
    transition: transform var(--duration-base) var(--easing-standard);

    &:hover {
      transform: translateY(-2px);

      .tag-inner {
        transform: rotateY(180deg);
      }
    }

    .tag-inner {
      position: relative;
      width: 100%;
      height: 100%;
      transition: transform 0.8s;
      transform-style: preserve-3d;

      .front,
      .back {
        display: flex;
        position: absolute;
        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;

        .tag-hole {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background-color: var(--bookmark-paper-hole);
          box-shadow: var(--bookmark-hole-shadow);
          position: absolute;
          top: 12px;
        }
      }
      .front {
        border-radius: 10px;
        background: var(--bookmark-paper-front);
        color: var(--brand-secondary-strong);

        .tag-content {
          display: -webkit-box;
          max-width: 3.6em;
          margin: 40px 0 10px 0;
          writing-mode: vertical-lr;
          line-height: 1.2em;
          overflow: hidden;
          -webkit-line-clamp: 3;
          line-clamp: 3;
          -webkit-box-orient: vertical;
          user-select: none;
        }
      }
      .back {
        transform: rotateY(180deg);
        border-radius: 10px;
        background: var(--bookmark-paper-back);

        .tag-comment {
          display: -webkit-box;
          max-width: 3.3em;
          margin: 40px 0 10px 0;
          writing-mode: vertical-lr;
          line-height: 1.1em;
          -webkit-line-clamp: 3;
          line-clamp: 3;
          -webkit-box-orient: vertical;
          user-select: none;

          &.primary {
            color: var(--text-on-brand);
          }

          &.info {
            color: var(--text-secondary);
          }
        }
      }
    }

    /* 胶囊操作栏：默认隐藏，点击书签体后展开；明确边框与阴影保证轮廓清晰 */
    .action-dock {
      position: absolute;
      left: calc(100% + 10px);
      top: 50%;
      transform: translateY(-50%) translateX(-8px);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 10px 8px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-default);
      background: var(--surface-card);
      backdrop-filter: blur(10px);
      box-shadow: var(--shadow-md);
      z-index: 3;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition:
        opacity var(--duration-fast) var(--easing-standard),
        transform var(--duration-fast) var(--easing-standard),
        visibility var(--duration-fast) var(--easing-standard);

      &.show {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transform: translateY(-50%) translateX(0);
      }

      .dock-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border-radius: 50%;
        border: 1px solid var(--border-soft);
        background: var(--surface-strong);
        color: var(--text-tertiary);
        cursor: var(--t-mouse-cursor-link), pointer;
        outline: none;
        opacity: 0;
        transform: translateY(6px);
        transition:
          transform var(--duration-fast) var(--easing-standard),
          border-color var(--duration-fast) var(--easing-standard),
          background var(--duration-fast) var(--easing-standard),
          color var(--duration-fast) var(--easing-standard),
          box-shadow var(--duration-fast) var(--easing-standard),
          opacity var(--duration-fast) var(--easing-standard);

        .dock-icon {
          width: 14px;
          height: 14px;
        }

        &:hover,
        &:focus-visible {
          transform: translateY(-1px);
          border-color: var(--border-brand);
          background: var(--surface-brand-soft);
          color: var(--brand-primary);
          box-shadow: var(--shadow-xs);
        }

        &:active {
          transform: scale(0.92);
        }

        &.star-btn.is-starred {
          border-color: var(--border-warning);
          background: var(--surface-warning-soft);
          color: var(--warning);
        }
      }

      /* 展开时按钮依次浮现 */
      &.show .dock-btn {
        opacity: 1;
        transform: translateY(0);

        &:nth-child(1) {
          transition-delay: 0.03s;
        }

        &:nth-child(2) {
          transition-delay: 0.07s;
        }

        &:nth-child(3) {
          transition-delay: 0.11s;
        }
      }
    }
  }

  &-footer {
    margin-top: 0.5em;

    .tag-time {
      font-size: 14px;
      color: var(--brand-secondary-strong);
      line-height: 1em;
    }
  }
}
// 组件进场动画
.tag-fade-in {
  animation: tagFadeIn 0.5s;
}
@keyframes tagFadeIn {
  0% {
    opacity: 0;
    scale: 0.85;
  }
  100% {
    opacity: 1;
    scale: 1;
  }
}
</style>
