import { ref, watch, Ref } from 'vue'
import { applyBookmarkUnderline } from '@/services/reader/bookmark'
import type { BookMark } from '@/services/reader/bookmarkState'
import type { EpubRenditionLike } from '@/services/reader/epubTypes'
import type { UnderlineStyle } from '@/services/reader'

interface UseBookmarkEditorArgs {
  bookMarkStore: ReturnType<typeof import('@/services/reader/bookmarkState').useBookMarkState>
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
