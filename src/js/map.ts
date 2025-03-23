type iconType = 'bookOpen' | 'delete' | 'info' | 'goBack' | 'bookmark' | 'delBookMark' | 'comment';
type themeType = 'light' | 'dark';
// 右键菜单ContextMenu
export interface ContextMenuData {
  x: number;
  y: number;
  width: number;
  theme: themeType;
  items: ContextMenuItem[];
}

export interface ContextMenuItem {
  label: string;
  type?: iconType; 
  onClick?: (e: MouseEvent | KeyboardEvent) => void;
}

// [ID].json配置文件参数
export interface Book {
  id: string
  cover: string
  title: string
  author: string
  language: string
  size: string
  lastRead: string
  added: string
  path: string
  location: string
}