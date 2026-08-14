import { getAppliedAppThemeMode } from '@/services/theme/themeService'
import { ContextMenuData, ContextMenuItem } from '@/types/contextMenu'

const DEFAULT_VIEWPORT_MARGIN = 20

interface BuildContextMenuArgs {
  x: number
  y: number
  menuItems: ContextMenuItem[]
  margin?: number
  theme?: 'light' | 'dark'
}

/**
 * 组装右键菜单数据。
 *
 * 菜单的最终显示位置（含边缘翻转与视口夹取）由 ContextMenu 组件
 * 根据自身真实渲染尺寸计算，这里只负责归一化锚点、主题与边距。
 */
export const buildContextMenuData = (args: BuildContextMenuArgs): ContextMenuData => {
  const { x, y, menuItems, margin = DEFAULT_VIEWPORT_MARGIN, theme = getAppliedAppThemeMode() } =
    args

  return {
    anchor: { x, y },
    items: menuItems,
    theme,
    margin,
  }
}
