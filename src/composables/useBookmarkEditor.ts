import { ref, watch, Ref } from 'vue'
import { applyBookmarkUnderline } from '@/services/reader/epub/bookmarkService'
import type { BookMark, useBookMarkStore } from '@/store/bookMark'
import type { EpubRenditionLike } from '@/types/epub'
import type { UnderlineStyle } from '@/constants/bookmark'

interface UseBookmarkEditorArgs {
  bookMarkStore: ReturnType<typeof useBookMarkStore>
  rendition: Ref<EpubRenditionLike | null>
  defaultUnderlineStyle: UnderlineStyle
}

export const useBookmarkEditor = (args: UseBookmarkEditorArgs) => {
  const { bookMarkStore, rendition, defaultUnderlineStyle } = args

  const bookMarkEditionVisible = ref(false)
  const bookMarkEditionContent = ref('')

  const openEditorByMarkId = (markId: string) => {
    const target = bookMarkStore.getBookMark(markId)?.[0]
    if (!target) {
      return
    }
    bookMarkEditionContent.value = JSON.stringify(target)
    bookMarkEditionVisible.value = true
  }

  const closeEditor = () => {
    bookMarkEditionVisible.value = false
  }

  watch(bookMarkEditionContent, (newVal) => {
    if (!newVal) {
      return
    }

    const updated = JSON.parse(newVal) as BookMark
    bookMarkStore.updateBookMark(updated)

    if (rendition.value) {
      applyBookmarkUnderline(rendition.value, updated, defaultUnderlineStyle)
    }
  })

  return {
    bookMarkEditionVisible,
    bookMarkEditionContent,
    openEditorByMarkId,
    closeEditor,
  }
}
