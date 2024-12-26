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
        <span class="book-title h1-title">
          {{ title }}
        </span>
        <span class="book-description h2-title">
          {{ description }}
        </span>
        <span class="book-creator h2-title">
          <span style="font-weight: bold;">作者:</span> {{ creator }}
        </span>
        <span class="book-publisher h2-title">
          <span style="font-weight: bold;">出版社:</span> {{ publisher }}
        </span>
        <span class="book-pubdate h2-title">
          <span style="font-weight: bold;">出版日期:</span> {{ pubdate }}
        </span>
        <span class="book-language h2-title">
          <span style="font-weight: bold;">语言:</span> {{ language }}
        </span>
        <span class="book-rights h2-title">
          <span style="font-weight: bold;">版权信息:</span> {{ rights }}
        </span>
        <span class="book-identifier h2-title">
          <span style="font-weight: bold;">唯一标识:</span> {{ identifier }}
        </span>
      </div>
    </div>
  </el-dialog>
</template>

<script>
import { readFile, writeFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import ePub from 'epubjs'
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
      defaultCover: './src/assets/default-cover.png',
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
      }
    };
  },
  methods: {
    async onOpen() {
      const solidBook = await readFile(`T-Reader/${this.bookId}.epub`, {
        baseDir: BaseDirectory.Document,
      })
      const arrayBuffer = solidBook.buffer
      const epub = ePub(arrayBuffer)
      const cover = await epub.coverUrl()
      this.bookCover = cover ?? this.defaultCover
      const metadata = await epub.loaded.metadata
      this.creator = metadata.creator
      this.description = metadata.description
      this.identifier = metadata.identifier
      this.language = this.languageType[metadata.language] ?? metadata.language
      this.pubdate = metadata.pubdate
      this.publisher = metadata.publisher
      this.rights = metadata.rights
      this.title = metadata.title
    }
  }
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
<style>
.info-dialog-wrapper {
  max-height: 70%;
  width: auto;
  display: flex;
  transition: all 0.3s ease-in;
  padding: 0;
  background-color: var(--t-color-light-cyan);
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

    .book-title {
      text-align: center;
      margin-top: 10px;
    }
    .book-description {
      text-indent: 2em;
    }
    .h1-title {
      font-size: 20px;
      font-weight: bold;
      color: var(--t-color-dark-cyan);
    }
    .h2-title {
      color: var(--t-color-cyan);
      margin-left: 5px;
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
      scale: 0.8;
      opacity: 0;
    }
  }
}
</style>