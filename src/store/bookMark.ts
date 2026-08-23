import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { BookMark } from '@/services/book/types'

export type { BookMark }

type BookMarkPatch = Partial<BookMark> & Pick<BookMark, 'id'>

export const useBookMarkStore = defineStore('bookMark', () => {
  const bookMarks = ref<BookMark[]>([])

  // 批量导入书签
  const importBookMark = (bookMarkList: BookMark[]) => {
    bookMarks.value = bookMarkList
  }

  // 添加单个书签
  const addBookMark = (mark: BookMark) => {
    bookMarks.value.push(mark)
  }

  // 批量追加书签
  const addBookMarks = (marks: BookMark[]) => {
    bookMarks.value = bookMarks.value.concat(marks)
  }

  // 按书签 id 删除
  const removeBookMark = (id: string) => {
    bookMarks.value = bookMarks.value.filter((item) => item.id !== id)
  }

  // 清空当前书签列表
  const clearBookMarks = () => {
    bookMarks.value = []
  }

  // 按书签 id 查询
  const getBookMark = (id: string) => {
    return bookMarks.value.filter((item) => item.id === id)
  }

  // 根据补丁更新指定书签
  const updateBookMark = (patch: BookMarkPatch) => {
    if (!patch.id) {
      return
    }

    bookMarks.value = bookMarks.value.map((item) => {
      if (item.id === patch.id) {
        return { ...item, ...patch }
      }
      return item
    })
  }

  return {
    bookMarks,
    addBookMark,
    addBookMarks,
    removeBookMark,
    clearBookMarks,
    importBookMark,
    getBookMark,
    updateBookMark,
  }
})
