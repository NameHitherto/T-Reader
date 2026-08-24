import { ref } from 'vue'
import type { BookMark } from '@/services/book/types'

export type { BookMark }
type BookMarkPatch = Partial<BookMark> & Pick<BookMark, 'id'>
const bookMarks = ref<BookMark[]>([])

export const useBookMarkState = () => ({
  bookMarks,
  addBookMark: (mark: BookMark) => bookMarks.value.push(mark),
  addBookMarks: (marks: BookMark[]) => {
    bookMarks.value = bookMarks.value.concat(marks)
  },
  removeBookMark: (id: string) => {
    bookMarks.value = bookMarks.value.filter((item) => item.id !== id)
  },
  clearBookMarks: () => {
    bookMarks.value = []
  },
  importBookMark: (marks: BookMark[]) => {
    bookMarks.value = marks
  },
  getBookMark: (id: string) => bookMarks.value.filter((item) => item.id === id),
  updateBookMark: (patch: BookMarkPatch) => {
    if (!patch.id) return
    bookMarks.value = bookMarks.value.map((item) =>
      item.id === patch.id ? { ...item, ...patch } : item,
    )
  },
})
