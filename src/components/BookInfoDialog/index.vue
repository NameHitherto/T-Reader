<template>
  <el-dialog
    align-center
    destroy-on-close
    :append-to-body="true"
    class="info-dialog-wrapper"
    :show-close="false"
    :close-on-press-escape="false"
    @open="onOpen"
  >
    <div class="info-container">
      <div class="book-image">
        <img :src="bookCover" />
      </div>
      <div class="book-details">
        <el-scrollbar class="book-details-scrollbar">
          <div>
            <el-row class="row">
              <el-col class="col title" :span="24">
                <span class="col-title">书名</span>
                <span class="book-title">{{ title || '--' }}</span>
              </el-col>
            </el-row>
            <el-row class="row">
              <el-col class="col description" :span="24">
                <span class="col-title">简介</span>
                <span class="col-text">{{ description || '--' }}</span>
              </el-col>
            </el-row>
            <el-row class="row">
              <el-col class="col creator" :span="6">
                <span class="col-title">作者</span>
                <span class="col-h">{{ creator || '--' }}</span>
              </el-col>
              <el-col class="col publisher" :span="17">
                <span class="col-title">出版社</span>
                <span class="col-h">{{ publisher || '--' }}</span>
              </el-col>
            </el-row>
            <el-row class="row">
              <el-col class="col pubdate" :span="24">
                <span class="col-title">出版日期</span>
                <span class="col-h">{{ pubdate || '--' }}</span>
              </el-col>
            </el-row>
            <el-row class="row">
              <el-col class="col language" :span="6">
                <span class="col-title">语言</span>
                <span class="col-h">{{ language || '--' }}</span>
              </el-col>
              <el-col class="col rights" :span="17">
                <span class="col-title">版权信息</span>
                <span class="col-h">{{ rights || '--' }}</span>
              </el-col>
            </el-row>
            <el-row class="row">
              <el-col class="col identifier" :span="24">
                <span class="col-title">唯一标识</span>
                <span class="col-h">{{ identifier || '--' }}</span>
              </el-col>
            </el-row>
          </div>
        </el-scrollbar>
      </div>
    </div>
  </el-dialog>
</template>

<script>
import ePub from 'libs/epub.js'
import defaultCover from '@/assets/default-cover.png'
import { ensureBookCache, loadBookBinary, loadBookConfig } from '@/services/book/bookRepository'
import { logWarn } from '@/utils/logger'

export default {
  name: 'BookInfoDialog',
  props: {
    bookKey: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      defaultCover,
      bookCover: '',
      creator: '',
      description: '',
      identifier: '',
      language: '',
      pubdate: '',
      publisher: '',
      rights: '',
      title: '',
      languageType: {
        zh: '中文',
        'zh-cn': '简体中文',
        'zh-CN': '简体中文',
        'zh-tw': '繁体中文',
        'zh-TW': '繁体中文',
        en: '英语',
        jp: '日语',
      },
    }
  },
  methods: {
    resetFields() {
      this.bookCover = this.defaultCover
      this.creator = ''
      this.description = ''
      this.identifier = ''
      this.language = ''
      this.pubdate = ''
      this.publisher = ''
      this.rights = ''
      this.title = ''
    },
    async onOpen() {
      this.resetFields()

      const bookConfig = await loadBookConfig(this.bookKey)
      const bookCache = await ensureBookCache(this.bookKey)
      this.bookCover = bookCache?.coverUrl || this.defaultCover
      this.creator = bookConfig.author || ''
      this.title = bookCache?.title || ''

      const loadedBook = await loadBookBinary(this.bookKey)
      if (loadedBook.format !== 'epub') {
        return
      }

      const arrayBuffer = loadedBook.bookData.buffer.slice(
        loadedBook.bookData.byteOffset,
        loadedBook.bookData.byteOffset + loadedBook.bookData.byteLength,
      )
      const epub = ePub(arrayBuffer)

      try {
        const metadata = await epub.loaded.metadata
        this.creator = metadata.creator || this.creator
        this.description = metadata.description || ''
        this.identifier = metadata.identifier || ''
        this.language = this.languageType[metadata.language] ?? metadata.language ?? ''
        this.pubdate = metadata.pubdate || ''
        this.publisher = metadata.publisher || ''
        this.rights = metadata.rights || ''
        this.title = metadata.title || this.title
      } finally {
        try {
          epub.destroy?.()
        } catch (error) {
          logWarn('bookInfo', '销毁 EPUB 实例失败', error)
        }
      }
    },
  },
}
</script>

<style scoped>
.info-container {
  position: relative;

  .book-details {
    display: flex;
    flex-direction: column;
  }
}
</style>
<style lang="scss">
.info-dialog-wrapper {
  max-height: 70vh;
  width: auto;
  display: flex;
  transition: transform var(--duration-base) var(--easing-standard);
  padding: 0;
  background: transparent;
  box-shadow: none;
  overflow: hidden;

  .info-container {
    width: 100%;
    height: 100%;
    flex: 1;
    min-width: 0;
    position: relative;

    .book-image {
      display: inline-flex;
      width: 100%;
      height: 100%;
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-lg);
      background: var(--surface-card-soft);

      img {
        position: relative;
        width: 100%;
        object-fit: cover;
        max-height: 70vh;
        transition:
          transform var(--duration-base) var(--easing-standard),
          opacity var(--duration-base) var(--easing-standard);
        z-index: 1;
      }
    }
  }

  .book-details {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    scale: 0.95;
    opacity: 0;
    letter-spacing: 1px;
    transition: all var(--duration-slow) var(--easing-standard);
    overflow: auto;
    padding: 8px;
    background: var(--surface-overlay);
    backdrop-filter: blur(14px);
    z-index: 1;

    &::-webkit-scrollbar {
      width: 10px;
    }
    &::-webkit-scrollbar-thumb {
      background-color: var(--scrollbar-thumb);
      border-radius: 5px;
    }
    &::-webkit-scrollbar-thumb:hover {
      background-color: var(--scrollbar-thumb-strong);
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &-scrollbar {
      height: 100%;
      padding: 5px;

      .row {
        margin-bottom: 10px;
        gap: 8px;

        .col {
          display: flex;
          flex-direction: column;
          padding: 12px 14px;
          border-radius: var(--radius-md);
          background: linear-gradient(180deg, var(--surface-card), var(--surface-card-muted));
          box-shadow: var(--shadow-sm);
          position: relative;
          color: var(--text-primary);
          opacity: 0.98;
          overflow: hidden;

          &::before {
            content: '';
            position: absolute;
            inset: 0 auto 0 0;
            width: 4px;
            border-radius: 999px;
            background: var(--card-accent, var(--brand-primary));
          }

          .book-title {
            font-size: 22px;
            font-weight: bold;
          }
          .col-title {
            opacity: 0.8;
            font-size: 12px;
            margin-bottom: 0.5rem;
            color: var(--text-tertiary);
          }
          .col-text {
            font-size: 16px;
            line-height: 2;
            color: var(--text-secondary);
          }
          .col-h {
            margin-bottom: 0.5rem;
            font-size: 20px;
            font-weight: 700;
            line-height: 1;
            color: var(--text-primary);
          }

          &.title {
            --card-accent: var(--brand-primary);
          }
          &.description {
            --card-accent: var(--success);
          }
          &.creator {
            --card-accent: var(--brand-secondary);
          }
          &.publisher {
            --card-accent: var(--accent-orange);
          }
          &.pubdate {
            --card-accent: var(--accent-violet);
          }
          &.language {
            --card-accent: var(--accent-pink);
          }
          &.rights {
            --card-accent: var(--brand-primary-strong);
          }
          &.identifier {
            --card-accent: var(--accent-magenta);
          }
        }
      }
      .row:last-child {
        margin-bottom: 0;
      }
    }
  }

  &:hover {
    transform: scale(1.02);
    box-shadow: none;

    .book-details {
      scale: 1;
      opacity: 1;
    }

    img {
      opacity: 0.2;
      transform: scale(1.04);
    }
  }
}
</style>
