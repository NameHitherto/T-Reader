<template>
  <div class="bookmark">
    <div class="bookmark-header">
      <span class="prefix">书签</span>
      <BubbleToggle
        v-model="viewType"
        class="bookmark-view-toggle"
        :options="viewTypeOptions"
        aria-label="书签视图切换"
        @change="handleViewTypeChange"
      />
    </div>
    <div class="bookmark-body">
      <el-scrollbar
        v-if="viewType === 'tag'"
        ref="scrollbar"
        class="tag-scrollbar"
        @wheel="handleWheel"
        @scroll="handleScroll"
      >
        <div class="tag-wrapper">
          <BookMarkTag
            v-for="(bookmark, idx) in rankedBooksMarks"
            :key="bookmark.id"
            :book-mark="bookmark"
            :is-first="idx === 0"
            :is-last="idx === booksMarks.length - 1"
            @delete="deleteBookMark(bookmark)"
            @jump="jumpToRead(bookmark)"
          />
        </div>
      </el-scrollbar>
      <el-table
        v-else-if="viewType === 'table'"
        class="table"
        :data="booksMarks"
        :max-height="tableMaxHeight"
        :default-sort="{ prop: 'createTime', order: 'descending' }"
        style="width: 100%"
      >
        <el-table-column
          prop="bookTitle"
          label="书名"
          min-width="180"
          :show-overflow-tooltip="{ popperClass: 'bookmark-cell-tooltip' }"
        />
        <el-table-column
          prop="content"
          label="内容"
          min-width="220"
          :show-overflow-tooltip="{ popperClass: 'bookmark-cell-tooltip' }"
        />
        <el-table-column
          prop="comments"
          label="笔记内容"
          min-width="180"
          :show-overflow-tooltip="{ popperClass: 'bookmark-cell-tooltip' }"
        >
          <template #default="{ row }">
            <span class="table-comment">{{ row.comments?.trim() ? row.comments : '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column fixed="right" label="操作" width="100">
          <template #default="item">
            <div class="table-actions">
              <button
                class="table-action-btn"
                type="button"
                title="跳转阅读"
                aria-label="跳转阅读"
                @click="jumpToRead(item.row)"
              >
                <AppIcon name="bookOpen" :size="16" />
              </button>
              <button
                class="table-action-btn table-action-btn--delete"
                type="button"
                title="删除笔记"
                aria-label="删除笔记"
                @click="deleteBookMark(item.row)"
              >
                <AppIcon name="delete" :size="16" />
              </button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :image-size="120" description="暂无笔记" />
        </template>
      </el-table>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import BookMarkTag from '@/components/BookMark/bookMarkTag.vue'
import BubbleToggle from '@/components/common/BubbleToggle/index.vue'
import AppIcon from '@/components/common/AppIcon/index.vue'
import { BookMark } from '@/store/bookMark'
import { ElMessageBox } from 'element-plus'
import { loadAllBookMarks, saveAllBookMarks } from '@/services/book/bookMarksRepository'
import { openReaderWindowWithPrecheck } from '@/services/reader/windowLaunch'
import { formatDateToNumber } from '@/utils/date'

export default defineComponent({
  name: 'BookMark',
  components: {
    BookMarkTag,
    BubbleToggle,
    AppIcon,
  },
  data() {
    return {
      booksMarks: [] as BookMark[],
      scrollLeft: 0,
      viewType: '' as 'tag' | 'table',
      viewTypeOptions: [
        { label: '标签', value: 'tag' },
        { label: '表格', value: 'table' },
      ] as { label: string; value: 'tag' | 'table' }[],
      tableMaxHeight: 0,
    }
  },
  computed: {
    groupedBooksMarks() {
      const temp = [...this.booksMarks]

      return temp.reduce(
        (acc, bookMark) => {
          if (!acc[bookMark.bookName]) {
            acc[bookMark.bookName] = []
          }
          acc[bookMark.bookName].push(bookMark)
          return acc
        },
        {} as Record<string, BookMark[]>,
      )
    },
    rankedBooksMarks() {
      return [...this.booksMarks].sort(
        (a, b) => formatDateToNumber(b.createTime) - formatDateToNumber(a.createTime),
      )
    },
    scrollLeftMax() {
      const wrapperWidth = document.querySelector('.el-scrollbar__view')?.clientWidth
      const contentWidth = document.querySelector('.tag-wrapper')?.clientWidth
      if (!wrapperWidth || !contentWidth) {
        return 0
      }
      return contentWidth - wrapperWidth
    },
  },
  async mounted() {
    const storedViewType = localStorage.getItem('bookMarkViewType')
    if (storedViewType) {
      this.viewType = storedViewType as 'tag' | 'table'
    } else {
      this.viewType = 'tag'
    }
    this.updateTableMaxHeight()
    window.addEventListener('resize', this.updateTableMaxHeight)
    await this.loadBookMarks()
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.updateTableMaxHeight)
  },
  methods: {
    async loadBookMarks() {
      this.booksMarks = await loadAllBookMarks()
    },
    async saveBookMarks() {
      await saveAllBookMarks(this.booksMarks)
    },
    async deleteBookMark(bookMark: BookMark) {
      ElMessageBox.confirm('是否删除此笔记？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        center: true,
        showClose: false,
      })
        .then(async () => {
          this.booksMarks = this.booksMarks.filter((item) => item.id !== bookMark.id)
          await this.saveBookMarks()
        })
        .catch(() => {
          return
        })
    },
    handleWheel(e: WheelEvent) {
      e.preventDefault()
      const scrollbarRef = this.$refs.scrollbar as
        | { setScrollLeft: (left: number) => void }
        | undefined
      this.scrollLeft = this.scrollLeft + e.deltaY >= 0 ? this.scrollLeft + e.deltaY : 0
      this.scrollLeft = this.scrollLeft > this.scrollLeftMax ? this.scrollLeftMax : this.scrollLeft
      scrollbarRef?.setScrollLeft(this.scrollLeft)
    },
    handleScroll(amount: { scrollLeft: number }) {
      this.scrollLeft = amount.scrollLeft
    },
    handleViewTypeChange(value: 'tag' | 'table') {
      this.viewType = value
      localStorage.setItem('bookMarkViewType', value)
    },
    updateTableMaxHeight() {
      this.tableMaxHeight = window.innerHeight * 0.85 - 32
    },
    jumpToRead(bookMark: BookMark) {
      ElMessageBox.confirm('是否前往阅读？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info',
        center: true,
        showClose: false,
      })
        .then(async () => {
          await this.openBook(bookMark.bookName, bookMark.bookCfi)
        })
        .catch(() => {
          return
        })
    },
    async openBook(bookKey: string, cfi: string) {
      await openReaderWindowWithPrecheck(bookKey, cfi)
    },
  },
})
</script>

<style lang="scss" scoped>
.bookmark {
  width: 100%;
  height: 100%;
  background-image: radial-gradient(var(--surface-grid-dot) 2px, transparent 0);
  background-size: 30px 30px;
  animation: backgroundMove 2s infinite linear;
  display: flex;
  flex-direction: column;
  min-width: 0;
  user-select: none;
  background-color: var(--app-bg);

  &-header {
    height: 15%;
    display: flex;
    justify-content: center;
    align-items: end;

    .prefix {
      font-size: 24px;
      font-weight: bold;
      font-style: italic;
      letter-spacing: 1em;
      text-shadow: var(--text-shadow-soft);
      color: var(--text-primary);
      margin-bottom: 6px;
    }

    .bookmark-view-toggle {
      --bubble-toggle-shell-padding: 6px;
      --bubble-toggle-shell-bg: var(--surface-warning-soft);
      --bubble-toggle-shell-border: var(--border-warning);
      --bubble-toggle-shell-shadow: var(--shadow-sm);
      --bubble-toggle-focus-ring: var(--surface-warning-soft-strong);
      --bubble-toggle-font-size: 24px;
      --bubble-toggle-font-weight: 700;
      --bubble-toggle-font-style: italic;
      --bubble-toggle-letter-spacing: 1em;
      --bubble-toggle-stage-offset-inline-end: -1em;
      --bubble-toggle-text: var(--text-secondary);
      --bubble-toggle-active-text: var(--text-primary);
    }
  }
  &-body {
    flex: 1;
    padding: 1rem;

    .table {
      :deep(.el-table__header th.el-table__cell) {
        background: var(--table-header-bg);
        color: var(--text-secondary);
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.01em;
      }

      :deep(.el-table__body td.el-table__cell) {
        font-size: 13px;
      }

      .table-comment {
        color: var(--text-secondary);
      }

      .table-actions {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .table-action-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: 1px solid var(--border-soft);
        border-radius: 50%;
        background: var(--surface-strong);
        color: var(--text-tertiary);
        cursor: var(--t-mouse-cursor-link), pointer;
        outline: none;
        transition:
          transform var(--duration-fast) var(--easing-standard),
          border-color var(--duration-fast) var(--easing-standard),
          background-color var(--duration-fast) var(--easing-standard),
          color var(--duration-fast) var(--easing-standard),
          box-shadow var(--duration-fast) var(--easing-standard);

        &:hover,
        &:focus-visible {
          border-color: var(--border-brand);
          background: var(--surface-brand-soft);
          color: var(--brand-primary);
          box-shadow: var(--shadow-xs);
        }

        &:active {
          transform: scale(0.92);
        }

        &--delete:hover,
        &--delete:focus-visible {
          border-color: var(--border-danger);
          background: var(--surface-danger-soft);
          color: var(--danger);
        }
      }
    }

    .tag-scrollbar {
      .tag-wrapper {
        display: inline-flex;
        padding-right: 20px;
      }
    }
  }
}

@keyframes backgroundMove {
  0% {
    background-position: -5px -5px;
  }
  100% {
    background-position: 25px 25px;
  }
}
</style>

<style lang="scss">
// 表格单元格溢出提示框：限制最大宽度，避免过长内容撑满窗口。
// popper 由 el-table 动态渲染并挂载到表格容器，scoped 样式无法命中，故使用全局样式。
.bookmark-cell-tooltip {
  max-width: 320px;
  white-space: normal;
}
</style>
