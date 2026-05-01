import type { EpubBookLike, EpubNavigationItem } from '@/types/epub'

export const collectParentChapterIndexes = (
  book: EpubBookLike | undefined,
  activeChapter: string
): string[] => {
  if (!book || !activeChapter) {
    return []
  }

  const indexGroup: string[] = []

  const parseParentNavItem = (nav: EpubNavigationItem) => {
    if (!nav || !nav.parent) {
      return
    }

    const parentNavItem = book?.navigation?.get?.(`#${nav.parent}`)
    if (!parentNavItem) {
      return
    }

    indexGroup.push(parentNavItem.href)
    parseParentNavItem(parentNavItem)
  }

  const currentNavItem = book?.navigation?.get?.(activeChapter)
  if (currentNavItem) {
    parseParentNavItem(currentNavItem)
  }

  return indexGroup
}

export const scrollDrawerToActiveChapter = (delay = 500) => {
  setTimeout(() => {
    const scrollbar = document.querySelector('.el-drawer__body') as HTMLElement | null
    const targetChapter = document.querySelector('.el-menu-item.is-active') as HTMLElement | null
    if (!scrollbar || !targetChapter) {
      return
    }

    const targetRect = targetChapter.getBoundingClientRect()
    const drawerRect = scrollbar.getBoundingClientRect()
    const scrollTop = targetRect.top - drawerRect.top + scrollbar.scrollTop
    scrollbar.scrollTo({
      top: scrollTop,
      behavior: 'auto',
    })
  }, delay)
}
