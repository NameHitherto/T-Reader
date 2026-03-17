import { ref, watch, Ref } from 'vue'
import { applyBookmarkHighlight } from '@/services/reader/bookmarkService'

interface UseBookmarkEditorArgs {
  bookMarkStore: any
  rendition: Ref<any>
  defaultHighlightColor: string
}

export const useBookmarkEditor = (args: UseBookmarkEditorArgs) => {
  const { bookMarkStore, rendition, defaultHighlightColor } = args

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

    const updated = JSON.parse(newVal)
    bookMarkStore.updateBookMark(updated)

    if (rendition.value) {
      applyBookmarkHighlight(rendition.value, updated, defaultHighlightColor)
    }
  })

  return {
    bookMarkEditionVisible,
    bookMarkEditionContent,
    openEditorByMarkId,
    closeEditor,
  }
}
