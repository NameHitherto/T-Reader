<template>
  <div class="bookmark">
    <div class="bookmark-header">
      <span class="prefix">书签</span>
      <div class="bubble">
        <div class="suffix" :class="viewType" @click="toggleViewType">
          <span class="option-tag">标签</span>
          <span class="option-table">表格</span>
        </div>
      </div>
    </div>
    <div class="bookmark-body">
      <el-scrollbar
        v-if="viewType === 'tag'"
        ref="scrollbar"
        class="tag-scrollbar"
        @wheel.native="handleWheel"
        @scroll="handleScroll"
      >
        <div class="tag-wrapper">
          <BookMarkTag
            v-for="(bookmark, idx) in rankedBooksMarks"
            :key="bookmark.id"
            :bookMark="bookmark"
            :isFirst="idx === 0"
            :isLast="idx === booksMarks.length - 1"
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
        style="width: 100%;"
      >
        <el-table-column prop="bookTitle" label="书名" width="180" show-overflow-tooltip />
        <el-table-column label="详情">
          <el-table-column
            prop="content"
            label="内容"
            show-overflow-tooltip
            min-width="120"
          />
          <el-table-column
            prop="comments"
            label="笔记内容"
            show-overflow-tooltip
            min-width="120"
          />
          <el-table-column prop="createTime" label="创建时间" width="160" />
        </el-table-column>
        <el-table-column fixed="right" label="操作" width="160">
          <template #default="item">
            <el-button @click="jumpToRead(item.row)">
              跳转
            </el-button>
            <el-button @click="deleteBookMark(item.row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import BookMarkTag from './BookMark/bookMarkTag.vue'
import { BookMark } from '@/store/bookMark'
import { formatDateToNumber } from '@/js/utils'
import { ElMessageBox } from 'element-plus'
import 'element-plus/es/components/message-box/style/css'
import { loadAllBookMarks, saveAllBookMarks } from '@/services/book/bookMarksRepository'
import { openReaderWindowWithPrecheck } from '@/services/reader/readerWindowLaunchService'

export default defineComponent({
  name: 'BookMark',
  components: {
    BookMarkTag,
  },
  data() {
    return {
      booksMarks: [] as BookMark[],
      scrollLeft: 0,
      viewType: '' as 'tag' | 'table',
      tableMaxHeight: 0,
    }
  },
  computed: {
    groupedBooksMarks() {
      const temp = [...this.booksMarks]
      return temp.reduce((acc, bookMark) => {
        if (!acc[bookMark.bookName]) {
          acc[bookMark.bookName] = []
        }
        acc[bookMark.bookName].push(bookMark)
        return acc
      }, {} as Record<string, BookMark[]>)
    },
    rankedBooksMarks() {
      return this.booksMarks.sort(
        (a, b) => formatDateToNumber(b.createTime) - formatDateToNumber(a.createTime)
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
      const scrollbarRef = this.$refs.scrollbar as any
      this.scrollLeft = this.scrollLeft + e.deltaY >= 0 ? this.scrollLeft + e.deltaY : 0
      this.scrollLeft = this.scrollLeft > this.scrollLeftMax ? this.scrollLeftMax : this.scrollLeft
      scrollbarRef?.setScrollLeft(this.scrollLeft)
    },
    handleScroll(amount: any) {
      this.scrollLeft = amount.scrollLeft
    },
    toggleViewType() {
      this.viewType = this.viewType === 'tag' ? 'table' : 'tag'
      localStorage.setItem('bookMarkViewType', this.viewType)
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
})
</script>

<style lang='scss' scoped>
.bookmark {
  width: 100%;
  height: 100%;
  background-image: radial-gradient(var(--surface-grid-dot) 2px, transparent 0);
  background-size: 30px 30px;
  border-left: 2px dashed var(--border-default);
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

    span {
      font-size: 24px;
      font-weight: bold;
      font-style: italic;
      letter-spacing: 1em;
      text-shadow: var(--text-shadow-soft);
      color: var(--text-primary);
    }

    .prefix {
      margin-bottom: 6px;
    }

    .bubble {
      padding: 6px;
      border-radius: var(--radius-sm);
      background: var(--surface-warning-gradient);
      border: 1px solid var(--border-warning);
      box-shadow: var(--shadow-sm);

      .suffix {
        position: relative;
        overflow: hidden;
        display: grid;
        margin-right: -1em;
        cursor: var(--t-mouse-cursor-link), pointer;

        span {
          grid-column-start: 1;
          grid-column-end: 1;
          grid-row-start: 1;
          grid-row-end: 1;
          transition: all 0.5s;
          color: var(--text-secondary);
        }

        &.tag .option-tag {
          transform: translate(0px, 0%);
          opacity: 1;
        }
        .option-tag {
          transform: translate(0px, -100%);
          opacity: 0;
        }
        .option-table {
          transform: translate(0px, 100%);
          opacity: 0;
        }
        &.table .option-table {
          transform: translate(0px, 0%);
          opacity: 1;
        }
      }
    }
  }
  &-body {
    flex: 1;
    padding: 1rem;

    .table {
      border-radius: var(--radius-lg);
      overflow: hidden;
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
