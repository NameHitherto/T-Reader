import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface BookMark {
  // 唯一标识
  id: String,
  // 笔记内容
  content: String,
  // 笔记所属书籍ID
  bookId: String,
  // 笔记所属书籍标题
  bookTitle: String,
  // 笔记cfi位置
  bookCfi: String,
  // 笔记range对象
  markRange: any,
  // 笔记创建时间
  createTime: String,
  // 个人评价, 可以置空
  comments: {
    type: String,
    required: false,
  },
}

export const useBookMarkStore = defineStore('bookMark', () => {
    const bookMark = ref<BookMark[]>([]);

    // 初始化赋值
    const importBookMark = (bookMarkList: BookMark[]) => {
      bookMark.value = bookMarkList;
    };

    // 添加笔记
    const addBookMark = (mark: BookMark) => {
        bookMark.value.push(mark);
    };

    // 删除笔记
    const removeBookMark = (id: String) => {
      // 删除指定id的笔记
      bookMark.value = bookMark.value.filter((item) => item.id !== id);
    };

    // 清空笔记
    const clearBookMark = () => {
        bookMark.value = [];
    };

    return {
        bookMark,
        addBookMark,
        removeBookMark,
        clearBookMark,
        importBookMark,
    };
});