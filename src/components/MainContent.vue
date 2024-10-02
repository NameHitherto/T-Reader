<template>
    <div class="main-content">
      <header class="header">
        <h1>全部图书</h1>
        <button @click="addBook">添加图书</button>
        <input type="file" ref="fileInput" @change="handleFileChange" style="display: none;" accept=".epub" />
      </header>
      <div class="book-list">
        <div class="book-header">
          <span>封面</span>
          <span>书名</span>
          <span>作者</span>
          <span>语言</span>
          <span>大小</span>
          <span>上次阅读时间</span>
          <span>加入时间</span>
          <span>操作</span>
        </div>
        <div class="book-item" v-for="book in books" :key="book.id" @dblclick="openBook(book.id)">
          <span><img :src="book.cover" alt="封面" /></span>
          <span>{{ book.title }}</span>
          <span>{{ book.author }}</span>
          <span>{{ book.language }}</span>
          <span>{{ book.size }}</span>
          <span>{{ book.lastRead }}</span>
          <span>{{ book.added }}</span>
          <span><button @click="deleteBook(book.id)">删除</button></span>
        </div>
      </div>
    </div>
  </template>
  
  <script>
  import { ref, onMounted } from 'vue';
  import ePub from 'epubjs';
  import { invoke } from '@tauri-apps/api/core';
  
  export default {
    name: 'MainContent',
    setup() {
      const fileInput = ref(null);
      const books = ref([]);
  
      const loadBooks = async () => {
        try {
          const loadedBooks = await invoke('load_books');
          for (const book of loadedBooks) {
            try {
              const epub = ePub(book.path);
              const cover = await epub.coverUrl();
              book.cover = cover;
            } catch (error) {
              console.error('Error loading cover for book:', book.title, error);
            }
          }
          books.value = loadedBooks;
        } catch (error) {
          console.error('Error loading books:', error);
        }
      };
  
      const addBook = () => {
        fileInput.value.click();
      };
  
      const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const book = ePub(e.target.result);
              const metadata = await book.loaded.metadata;
              const cover = await book.coverUrl();
  
              const newBook = {
                id: Date.now(),
                cover: cover,
                title: metadata.title,
                author: metadata.creator,
                language: metadata.language,
                size: (file.size / 1024 / 1024).toFixed(2) + 'MB',
                lastRead: new Date().toLocaleDateString(),
                added: new Date().toLocaleDateString(),
                path: file.path 
              };
  
              // 测试，打印解析结果到控制台
              console.log(newBook);
  
              // 保存解析结果到项目根目录
              await invoke('save_file', {
                filename: `${newBook.id}.json`,
                contents: JSON.stringify(newBook)
              });
  
              // 更新图书清单
              books.value.push(newBook);
            } catch (error) {
              console.error('Error reading or saving the file:', error);
            }
          };
          reader.readAsArrayBuffer(file);
        }
      };
  
      const deleteBook = async (id) => {
        try {
          await invoke('delete_book', { filename: `${id}.json` });
          books.value = books.value.filter(book => book.id !== id);
        } catch (error) {
          console.error('Error deleting the book:', error);
        }
      };
  
      const openBook = (id) => {
        console.log('Opening book:', id);
        // 使用 Vue 路由导航到阅读器页面，并传递书籍ID
        router.push({ name: 'Reader', query: { bookId: id } });
      };
  
      onMounted(() => {
        loadBooks();
      });
  
      return {
        fileInput,
        books,
        addBook,
        handleFileChange,
        deleteBook,
        openBook
      };
    }
  };
  </script>
  
  <style scoped>
  .main-content {
    flex: 1;
    padding: 20px;
    overflow: auto;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  
  .book-list {
    display: flex;
    flex-direction: column;
  }
  
  .book-header, .book-item {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
  }
  
  .book-header {
    font-weight: bold;
    border-bottom: 2px solid #ccc;
  }
  
  .book-item {
    border-bottom: 1px solid #eee;
  }
  
  .book-item span img {
    width: 50px;
    height: auto;
  }
  </style>