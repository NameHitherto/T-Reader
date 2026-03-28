import { ContextMenuData, ContextMenuItem } from '@/js/map'
import { getAppliedAppThemeMode } from '@/services/theme/themeService'

interface BuildContextMenuArgs {
  x: number
  y: number
  menuItems: ContextMenuItem[]
  width?: number
  itemHeight?: number
  precision?: number
  theme?: 'light' | 'dark'
}

export const buildContextMenuData = (
  args: BuildContextMenuArgs
): ContextMenuData => {
  const {
    x,
    y,
    menuItems,
    width = 160,
    itemHeight = 35,
    precision = 20,
    theme = getAppliedAppThemeMode(),
  } = args

  let menuX = x
  let menuY = y

  const menuHeight = itemHeight * menuItems.length
  const pageWidth = document.documentElement.clientWidth
  const pageHeight = document.documentElement.clientHeight

  if (menuX + width > pageWidth) {
    menuX -= width
  }
  menuX = Math.max(precision, menuX)
  menuX = Math.min(pageWidth - precision - width, menuX)

  if (menuY + menuHeight > pageHeight) {
    menuY -= menuHeight
  }
  menuY = Math.max(precision, menuY)
  menuY = Math.min(pageHeight - precision - menuHeight, menuY)

  return {
    x: menuX,
    y: menuY,
    width,
    items: menuItems,
    theme,
  }
}
