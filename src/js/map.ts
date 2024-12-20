// 右键菜单ContextMenu
export interface ContextMenuData {
  x: number;
  y: number;
  width: number;
  theme: string;
  items: ContextMenuItem[];
}

type iconType = 'bookOpen' | 'delete' | 'info' | 'goBack';

export interface ContextMenuItem {
  label: string;
  type?: iconType; 
  onClick?: (e: MouseEvent | KeyboardEvent) => void;
}