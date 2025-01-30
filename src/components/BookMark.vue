<template>
  <div class="bookmark">
    <div class="bookmark-header">
      <span>笔记书签</span>
    </div>
    <div class="bookmark-body">
      <el-scrollbar ref="scrollbar" class="tag-scrollbar" @wheel.native="handleWheel" @scroll="handleScroll">
        <div class="tag-wrapper">
          <BookMarkTag
            v-for="bookmark in booksMarks"
            :key="bookmark.id"
            :bookMark="bookmark"
            @delete="deleteBookMark(bookmark)"
          />
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import BookMarkTag from './BookMark/bookMarkTag.vue'
import { BookMark } from '@/store/bookMark'
import { invoke } from '@tauri-apps/api/core'
import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs'

interface Book {
  id: number
  cover: string
  title: string
  author: string
  language: string
  size: string
  lastRead: string
  added: string
  path: string
  location: string
}

export default defineComponent({
  name: 'BookMark',
  components: {
    BookMarkTag
  },
  data() {
    return {
      booksMarks: [] as BookMark[],
      loadedBooks: [] as Book[],
      scrollLeft: 0
    }
  },
  computed: {
    // 将书签列表按照书籍ID分组
    groupedBooksMarks() {
      // 临时变量，不影响原数组
      const temp = [...this.booksMarks]
      const groupedBooksMarks = temp.reduce((acc, bookMark) => {
        if (!acc[bookMark.bookId]) {
          acc[bookMark.bookId] = []
        }
        acc[bookMark.bookId].push(bookMark)
        return acc
      }, {} as Record<string, BookMark[]>)
      return groupedBooksMarks
    },
    scrollLeftMax() {
      const wrapperWidth = document.querySelector('.el-scrollbar__view')?.clientWidth
      const contentWidth = document.querySelector('.tag-wrapper')?.clientWidth
      if (!wrapperWidth || !contentWidth) {
        return 0
      }
      return contentWidth - wrapperWidth
    }
  },
  watch: {
  },
  methods: {
    async loadBookMarks() {
      this.loadedBooks = await invoke('load_books')
      this.booksMarks = []
      for(const book of this.loadedBooks) {
        let bookConfigData
        try {
          // 尝试获取云同步配置文件
          const cloudConfigData = await invoke('webdav_get', {
            filename: `${book.id}.json`,
          })
          bookConfigData = new Uint8Array(cloudConfigData as ArrayBufferLike)
        } catch (e) {
          // 获取云同步配置文件失败，使用本地配置文件
          bookConfigData = await readFile(
            `T-Reader/${book.id}.json`,
            { baseDir: BaseDirectory.Document }
          )
        }
        const bookConfig = JSON.parse(new TextDecoder().decode(bookConfigData))
        if (bookConfig.bookMarks) {
          this.booksMarks = [...this.booksMarks, ...bookConfig.bookMarks]
        }
      }
    },
    async saveBookMarks() {
      console.log('save before' ,this.groupedBooksMarks)
      // 根据分组后的书签列表更新配置文件
      this.loadedBooks.forEach(async(book) => {
        let bookConfigData
        try {
          // 尝试获取云同步配置文件
          const cloudConfigData = await invoke('webdav_get', {
            filename: `${book.id}.json`,
          })
          bookConfigData = new Uint8Array(cloudConfigData as ArrayBufferLike)
        } catch (e) {
          // 获取云同步配置文件失败，使用本地配置文件
          bookConfigData = await readFile(
            `T-Reader/${book.id}.json`,
            { baseDir: BaseDirectory.Document }
          )
        }
        const bookConfig = JSON.parse(new TextDecoder().decode(bookConfigData))
        if (!this.groupedBooksMarks[book.id]) {
          delete bookConfig.bookMarks
        } else {
          bookConfig.bookMarks = this.groupedBooksMarks[book.id]
        }
        const jsonString = JSON.stringify(bookConfig)
        const jsonUint8Array = new TextEncoder().encode(jsonString)
        await invoke('save_file', {
          filename: `${book.id}.json`,
          contents: jsonString,
        })
        await invoke('webdav_upload', {
          filename: `${book.id}.json`,
          contents: Array.from(jsonUint8Array),
        })
      })
    },
    async deleteBookMark(bookMark: BookMark) {
      console.log('delete before', this.booksMarks)
      this.booksMarks = this.booksMarks.filter((item) => item.id !== bookMark.id)
      console.log('delete after', this.booksMarks)
      await this.saveBookMarks()
    },
    handleWheel(e: WheelEvent) {
      e.preventDefault()
      const scrollbarRef = this.$refs.scrollbar as any
      // 根据滚动幅度调整滚动条位置
      this.scrollLeft = this.scrollLeft + e.deltaY >= 0 ? this.scrollLeft + e.deltaY : 0
      this.scrollLeft = this.scrollLeft > this.scrollLeftMax ? this.scrollLeftMax : this.scrollLeft
      scrollbarRef?.setScrollLeft(this.scrollLeft)
    },
    handleScroll(amount: any) {
      this.scrollLeft = amount.scrollLeft
    }
  },
  async mounted() {
    await this.loadBookMarks()
    console.log('load', this.booksMarks)
    console.log('grouped', this.groupedBooksMarks)
  }
})
</script>

<style lang='scss' scoped>
.bookmark {
  width: 100%;
  height: 100%;
  background-image: radial-gradient(rgba(12, 12, 12, 0.171) 2px, transparent 0);
  background-size: 30px 30px;
  border-left: 2px dashed #ccc;
  animation: backgroundMove 2s infinite linear;
  display: flex;
  flex-direction: column;
  min-width: 0;
  user-select: none;

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
    }
  }
  &-body {
    flex: 1;
    padding: 1rem;

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
