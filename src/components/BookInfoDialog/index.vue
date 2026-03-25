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
        <img :src="bookCover"/>
      </div>
      <div class="book-details">
        <el-scrollbar class="book-details-scrollbar">
          <div>
            <el-row class="row">
              <el-col class="col title" :span="24">
                <span class="col-title">书名</span>
                <span class="book-title">{{ title ? title : '--' }}</span>
              </el-col>
            </el-row>
            <el-row class="row">
              <el-col class="col description" :span="24">
                <span class="col-title">简介</span>
                <span class="col-text">{{ description ? description : '--' }}</span>
              </el-col>
            </el-row>
            <el-row class="row">
              <el-col class="col creator" :span="6">
                <span class="col-title">作者</span>
                <span class="col-h">{{ creator ? creator : '--' }}</span>
              </el-col>
              <el-col class="col publisher" :span="17">
                <span class="col-title">出版社</span>
                <span class="col-h">{{ publisher ? publisher : '--' }}</span>
              </el-col>
            </el-row>
            <el-row class="row">
              <el-col class="col pubdate" :span="24">
                <span class="col-title">出版日期</span>
                <span class="col-h">{{ pubdate ? pubdate : '--' }}</span>
              </el-col>
            </el-row>
            <el-row class="row">
              <el-col class="col language" :span="6">
                <span class="col-title">语言</span>
                <span class="col-h">{{ language ? language : '--' }}</span>
              </el-col>
              <el-col class="col rights" :span="17">
                <span class="col-title">版权信息</span>
                <span class="col-h">{{ rights ? rights : '--' }}</span>
              </el-col>
            </el-row>
            <el-row class="row">
              <el-col class="col identifier" :span="24">
                <span class="col-title">唯一标识</span>
                <span class="col-h">{{ identifier ? identifier : '--' }}</span>
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
import { loadBookBinary, loadBookCacheByConfig, loadBookConfig } from '@/services/book/bookRepository'
export default {
  name: 'BookInfoDialog',
  props: {
    bookId: {
      type: String,
      required: true
    }
  },  
  data() {
    return {
      defaultCover, // 默认封面
      bookCover: '', // 书籍封面
      creator: '', // 作者
      description: '', // 书籍描述
      identifier: '', // 书籍唯一标识
      language: '', // 语言
      pubdate: '', // 出版日期
      publisher: '', // 出版社
      rights: '', // 版权信息
      title: '', // 书籍标题
      languageType: {
        'zh': '中文',
        'zh-cn': '简体中文',
        'zh-CN': '简体中文',
        'zh-tw': '繁体中文',
        'zh-TW': '繁体中文',
        'en': '英文',
        'jp': '日文',
      },
    };
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

      const bookConfig = await loadBookConfig(this.bookId)
      const bookCache = await loadBookCacheByConfig(bookConfig)
      this.bookCover = bookCache?.cover || this.defaultCover
      this.creator = bookConfig.author || ''
      this.language = this.languageType[bookConfig.language] ?? bookConfig.language ?? ''
      this.title = bookConfig.title || ''

      if (bookConfig.format !== 'epub') {
        return
      }

      const bookData = await loadBookBinary(this.bookId, 'epub')
      const arrayBuffer = bookData.buffer.slice(
        bookData.byteOffset,
        bookData.byteOffset + bookData.byteLength
      )
      const epub = ePub(arrayBuffer)
      const cover = await epub.coverUrl()
      this.bookCover = cover ?? this.bookCover
      const metadata = await epub.loaded.metadata
      this.creator = metadata.creator || this.creator
      this.description = metadata.description || ''
      this.identifier = metadata.identifier || ''
      this.language = this.languageType[metadata.language] ?? metadata.language ?? this.language
      this.pubdate = metadata.pubdate || ''
      this.publisher = metadata.publisher || ''
      this.rights = metadata.rights || ''
      this.title = metadata.title || this.title
    }
  },
};
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
  max-height: 70%;
  width: auto;
  display: flex;
  transition: all 0.3s ease-in;
  padding: 0;
  background-color: #0d0d0d;
  box-shadow: var(--t-box-shadow-medium-light);

  .info-container {
    width: 100%;
    height: 100%;
    flex: 1;
    min-width: 0;

    .book-image {
      display: inline-block;
      width: 100%;
      height: 100%;

      img{
        position: relative;
        max-height: 70vh;
        transition: all 0.2s ease-out;
        z-index: 1;
        border-radius: 4px;
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
    transition: all 0.4s ease-in-out;
    overflow: auto;
    background: rgba(255, 255, 255, 0.15);
    z-index: 1;

    &::-webkit-scrollbar {
      width: 10px;
    }
    &::-webkit-scrollbar-thumb {
      background-color: rgba(0, 0, 0, 0.2);
      border-radius: 5px;
    }
    &::-webkit-scrollbar-thumb:hover {
      background-color: rgba(0, 0, 0, 0.4);
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
          padding: 5px 10px;
          border-radius: 16px;
          background: #1d1e22;
          box-shadow: 0 8px 16px -4px rgba(44, 45, 48, 0.047);
          position: relative;
          color: rgba(255, 255, 255, 0.7);
          opacity: 0.95;

          .book-title {
            font-size: 22px;
            font-weight: bold;
          }
          .col-title {
            opacity: .8;
            font-size: 12px;
            margin-bottom: .5rem;
          }
          .col-text {
            font-size: 16px;
            line-height: 2;
          }
          .col-h {
            margin-bottom: .5rem;
            font-size: 20px;
            font-weight: 700;
            line-height: 1;
          }

          &.title {
            background: #3b82f6;
          }
          &.description {
            background: #059669;
          }
          &.creator {
            background: #f59e0b;
          }
          &.publisher {
            background: #c2410c;
          }
          &.pubdate {
            background: #7c3aed;
          }
          &.language {
            background: #e11d48;
          }
          &.rights {
            background: #1e40af;
          }
          &.identifier {
            background: #d946ef;
          }
        }
      }
      .row:last-child {
        margin-bottom: 0;
      }
    }
  }

  &:hover {
    transform: scale(1.05);
    box-shadow: none;

    .book-details {
      scale: 1;
      opacity: 1;
    }

    img {
      opacity: 0.4;
      animation: imgBlendIn 1.2s ease-in-out;
    }
  }
}
@keyframes imgBlendIn {
  0% {
    opacity: 1;
    scale: 1;
    backdrop-filter: none;
  }
  20% {
    opacity: 0;
    scale: 0.8;
  }
  25% {
    opacity: 0;
    scale: 1;
  }
  100% {
    opacity: 0.4;
    scale: 1;
    backdrop-filter: blur(10px);
  }
}
</style>
