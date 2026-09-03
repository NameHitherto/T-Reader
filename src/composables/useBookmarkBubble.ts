import { ref, nextTick } from 'vue'
import type { BookMark } from '@/services/reader/bookmarkState'
import { BOOKMARK_UNDERLINE_CLASS } from '@/services/reader/bookmarkStyle'

export interface BookmarkBubblePosition {
  left: number
  top: number
  placement: 'top' | 'bottom'
  arrowLeft: number
}

interface UseBookmarkBubbleArgs {
  bookMarkStore: ReturnType<typeof import('@/services/reader/bookmarkState').useBookMarkState>
}

const BUBBLE_WIDTH = 320
const BUBBLE_APPROX_HEIGHT = 130
const VIEWPORT_PADDING = 12
const ANCHOR_GAP = 10

export const useBookmarkBubble = (args: UseBookmarkBubbleArgs) => {
  const { bookMarkStore } = args

  const bubbleVisible = ref(false)
  const activeBookmark = ref<BookMark | null>(null)
  const bubblePosition = ref<BookmarkBubblePosition>({
    left: 0,
    top: 0,
    placement: 'bottom',
    arrowLeft: 24,
  })

  let currentPointerCoords: { x: number; y: number } | null = null

  const closeBubble = () => {
    bubbleVisible.value = false
    activeBookmark.value = null
    currentPointerCoords = null
  }

  const computePosition = (
    markId: string,
    pointerCoords?: { x: number; y: number } | null,
  ): BookmarkBubblePosition => {
    const underlineEl = document.querySelector(
      `.${BOOKMARK_UNDERLINE_CLASS}[data-mark-id="${markId}"]`,
    ) as HTMLElement | SVGElement | null

    const rect = underlineEl?.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let anchorX = pointerCoords?.x ?? (rect ? rect.left + rect.width / 2 : viewportWidth / 2)
    const anchorTop = rect ? rect.top : (pointerCoords?.y ?? viewportHeight / 2)
    const anchorBottom = rect ? rect.bottom : anchorTop

    if (rect && pointerCoords) {
      anchorX = Math.max(rect.left, Math.min(pointerCoords.x, rect.right))
    }

    let placement: 'top' | 'bottom' = 'top'
    let top = anchorTop - BUBBLE_APPROX_HEIGHT - ANCHOR_GAP

    if (top < VIEWPORT_PADDING) {
      placement = 'bottom'
      top = anchorBottom + ANCHOR_GAP
    }

    let left = anchorX - BUBBLE_WIDTH / 2
    left = Math.max(
      VIEWPORT_PADDING,
      Math.min(left, viewportWidth - BUBBLE_WIDTH - VIEWPORT_PADDING),
    )

    const arrowLeft = Math.max(16, Math.min(anchorX - left, BUBBLE_WIDTH - 16))

    return {
      left,
      top,
      placement,
      arrowLeft,
    }
  }

  const syncCurrentPosition = () => {
    if (!bubbleVisible.value || !activeBookmark.value) return
    const markId = activeBookmark.value.id
    bubblePosition.value = computePosition(markId, currentPointerCoords)

    void nextTick(() => {
      const bubbleEl = document.querySelector('.annotation-bubble') as HTMLElement | null
      if (!bubbleEl) return

      const realHeight = bubbleEl.offsetHeight
      const underlineEl = document.querySelector(
        `.${BOOKMARK_UNDERLINE_CLASS}[data-mark-id="${markId}"]`,
      ) as HTMLElement | SVGElement | null
      const rect = underlineEl?.getBoundingClientRect()

      if (bubblePosition.value.placement === 'top') {
        const anchorTop = rect ? rect.top : (currentPointerCoords?.y ?? window.innerHeight / 2)
        bubblePosition.value.top = Math.max(VIEWPORT_PADDING, anchorTop - realHeight - ANCHOR_GAP)
      }
    })
  }

  const openBubbleByMarkId = (markId: string, pointerCoords?: { x: number; y: number } | null) => {
    const target = bookMarkStore.getBookMark(markId)?.[0]
    if (!target) {
      return
    }

    currentPointerCoords = pointerCoords ? { ...pointerCoords } : null
    activeBookmark.value = target
    bubblePosition.value = computePosition(markId, pointerCoords)
    bubbleVisible.value = true

    void nextTick(() => {
      const bubbleEl = document.querySelector('.annotation-bubble') as HTMLElement | null
      if (!bubbleEl) return

      const realHeight = bubbleEl.offsetHeight
      const underlineEl = document.querySelector(
        `.${BOOKMARK_UNDERLINE_CLASS}[data-mark-id="${markId}"]`,
      ) as HTMLElement | SVGElement | null
      const rect = underlineEl?.getBoundingClientRect()

      if (bubblePosition.value.placement === 'top') {
        const anchorTop = rect ? rect.top : (pointerCoords?.y ?? window.innerHeight / 2)
        bubblePosition.value.top = Math.max(VIEWPORT_PADDING, anchorTop - realHeight - ANCHOR_GAP)
      }
    })
  }

  const isBubbleRelatedTarget = (target: Node | null): boolean => {
    if (!target) return false
    const bubbleEl = document.querySelector('.annotation-bubble')

    return Boolean(bubbleEl?.contains(target))
  }

  return {
    bubbleVisible,
    activeBookmark,
    bubblePosition,
    openBubbleByMarkId,
    closeBubble,
    syncCurrentPosition,
    isBubbleRelatedTarget,
  }
}
