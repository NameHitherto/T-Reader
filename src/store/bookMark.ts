import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface BookMark {
  // 唯一标识
  id: string,
  // 笔记内容
  content: string,
  // 笔记所属书籍ID
  bookId: string,
  // 笔记所属书籍标题
  bookTitle: string,
  // 笔记cfi位置
  bookCfi: string,
  // 笔记创建时间
  createTime: string,
  // 个人评价, 可以置空
  comments?: string,
  // 笔记高亮颜色
  color?: string,
  // 高亮边框
  hasBorder?: boolean,
}

type BookMarkPatch = Partial<BookMark> & Pick<BookMark, 'id'>

export const useBookMarkStore = defineStore('bookMark', () => {
    const bookMarks = ref<BookMark[]>([]);

    // 初始化赋值
    const importBookMark = (bookMarkList: BookMark[]) => {
      bookMarks.value = bookMarkList;
    };

    // 添加笔记
    const addBookMark = (mark: BookMark) => {
        bookMarks.value.push(mark);
    };

    // 添加复数笔记
    const addBookMarks = (marks: BookMark[]) => {
        bookMarks.value = bookMarks.value.concat(marks);
    };

    // 删除笔记
    const removeBookMark = (id: string) => {
      // 删除指定id的笔记
      bookMarks.value = bookMarks.value.filter((item) => item.id !== id);
    };

    // 清空笔记
    const clearBookMarks = () => {
        bookMarks.value = [];
    };

    // 根据书籍ID获取笔记
    const getBookMark = (id: string) => {
      return bookMarks.value.filter((item) => item.id === id);
    };

    // 通过JSON字符串更新笔记
    const updateBookMark = (patch: BookMarkPatch) => {
      if (!patch.id) {
        return
      }

      // 更新指定id的笔记
      bookMarks.value = bookMarks.value.map((item) => {
        if (item.id === patch.id) {
          return { ...item, ...patch }
        }
        return item
      });
    }

    return {
        bookMarks,
        addBookMark,
        addBookMarks,
        removeBookMark,
        clearBookMarks,
        importBookMark,
        getBookMark,
        updateBookMark
    };
});