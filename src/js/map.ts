import { BookMark } from '../store/bookMark';
import { BookFormat } from './bookFormat';

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

/**
 * [ID].json配置文件参数
 */
export interface BookConfig {
  schemaVersion?: number;
  id: string;
  format?: BookFormat;
  locationFormat?: 'cfi' | 'paragraph';
  source?: string;
  deviceId?: string;
  updatedAt?: string;
  legacySync?: {
    bookId: string;
    progress: number;
    location: string;
    updatedAt: string;
    source: string;
    deviceId: string;
  };
  cover: string;
  title: string;
  author: string;
  language: string;
  size: string;
  progress?: number;
  lastRead: string;
  added: string;
  path: string;
  location: string;
  bookMarks?: BookMark[];
}