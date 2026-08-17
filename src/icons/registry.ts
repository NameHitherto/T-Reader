import addBookIcon from '@/assets/addBook.svg?raw'
import refreshIcon from '@/assets/refresh.svg?raw'
import settingIcon from '@/assets/setting.svg?raw'
import listViewIcon from '@/assets/icons/list-view.svg?raw'
import gridViewIcon from '@/assets/icons/grid-view.svg?raw'
import sortAscIcon from '@/assets/icons/sort-asc.svg?raw'
import sortDescIcon from '@/assets/icons/sort-desc.svg?raw'
import sortListIcon from '@/assets/icons/sort-list.svg?raw'
import sidebarBookshelfIcon from '@/assets/icons/sidebar-bookshelf.svg?raw'
import sidebarNoteIcon from '@/assets/icons/sidebar-note.svg?raw'
import sidebarGalleryIcon from '@/assets/icons/sidebar-gallery.svg?raw'
import sidebarAboutIcon from '@/assets/icons/sidebar-about.svg?raw'
import contactBilibiliIcon from '@/assets/icons/contact-bilibili.svg?raw'
import contactGithubIcon from '@/assets/icons/contact-github.svg?raw'
import contactEmailIcon from '@/assets/icons/contact-email.svg?raw'
import sunIcon from '@/assets/icons/sun.svg?raw'
import moonIcon from '@/assets/icons/moon.svg?raw'
import fullUrlIcon from '@/assets/icons/full-url.svg?raw'

import bookOpenIcon from '@/components/ContextMenu/assets/book-open.svg?raw'
import uploadIcon from '@/components/ContextMenu/assets/upload.svg?raw'
import deleteIcon from '@/components/ContextMenu/assets/delete.svg?raw'
import goBackIcon from '@/components/ContextMenu/assets/go-back.svg?raw'
import infoIcon from '@/components/ContextMenu/assets/info.svg?raw'
import editIcon from '@/components/ContextMenu/assets/edit.svg?raw'
import bookmarkIcon from '@/components/ContextMenu/assets/bookmark.svg?raw'
import delBookMarkIcon from '@/components/ContextMenu/assets/delBookMark.svg?raw'
import commentIcon from '@/components/ContextMenu/assets/comment.svg?raw'
import drawIcon from '@/components/ContextMenu/assets/draw.svg?raw'
import defaultIcon from '@/components/ContextMenu/assets/default.svg?raw'

export type IconRenderMode = 'mask' | 'image'

export type IconName =
  | 'addBook'
  | 'refresh'
  | 'setting'
  | 'listView'
  | 'gridView'
  | 'sortAsc'
  | 'sortDesc'
  | 'sortList'
  | 'sidebarBookshelf'
  | 'sidebarNote'
  | 'sidebarGallery'
  | 'sidebarAbout'
  | 'contactBilibili'
  | 'contactGithub'
  | 'contactEmail'
  | 'sun'
  | 'moon'
  | 'fullUrl'
  | 'bookOpen'
  | 'upload'
  | 'delete'
  | 'goBack'
  | 'info'
  | 'edit'
  | 'bookmark'
  | 'delBookMark'
  | 'comment'
  | 'draw'
  | 'default'

export interface IconDefinition {
  src: string
  mode: IconRenderMode
}

/**
 * 将 SVG 文本转换为 data URI，供 CSS mask-image 使用。
 * 使用 encodeURIComponent 编码可确保任意 UTF-8 内容安全（`#`、引号、换行等均会被转义，
 * 不会截断 URL）。构建期 SVG 以 `?raw` 形式随 JS bundle 内联，运行时零网络请求。
 */
const toDataUri = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg.trim())}`

const iconRegistry: Record<IconName, IconDefinition> = {
  addBook: { src: toDataUri(addBookIcon), mode: 'mask' },
  refresh: { src: toDataUri(refreshIcon), mode: 'mask' },
  setting: { src: toDataUri(settingIcon), mode: 'mask' },
  listView: { src: toDataUri(listViewIcon), mode: 'mask' },
  gridView: { src: toDataUri(gridViewIcon), mode: 'mask' },
  sortAsc: { src: toDataUri(sortAscIcon), mode: 'mask' },
  sortDesc: { src: toDataUri(sortDescIcon), mode: 'mask' },
  sortList: { src: toDataUri(sortListIcon), mode: 'mask' },
  sidebarBookshelf: { src: toDataUri(sidebarBookshelfIcon), mode: 'mask' },
  sidebarNote: { src: toDataUri(sidebarNoteIcon), mode: 'mask' },
  sidebarGallery: { src: toDataUri(sidebarGalleryIcon), mode: 'mask' },
  sidebarAbout: { src: toDataUri(sidebarAboutIcon), mode: 'mask' },
  contactBilibili: { src: toDataUri(contactBilibiliIcon), mode: 'mask' },
  contactGithub: { src: toDataUri(contactGithubIcon), mode: 'mask' },
  contactEmail: { src: toDataUri(contactEmailIcon), mode: 'mask' },
  sun: { src: toDataUri(sunIcon), mode: 'mask' },
  moon: { src: toDataUri(moonIcon), mode: 'mask' },
  fullUrl: { src: toDataUri(fullUrlIcon), mode: 'mask' },
  bookOpen: { src: toDataUri(bookOpenIcon), mode: 'mask' },
  upload: { src: toDataUri(uploadIcon), mode: 'mask' },
  delete: { src: toDataUri(deleteIcon), mode: 'mask' },
  goBack: { src: toDataUri(goBackIcon), mode: 'mask' },
  info: { src: toDataUri(infoIcon), mode: 'mask' },
  edit: { src: toDataUri(editIcon), mode: 'mask' },
  bookmark: { src: toDataUri(bookmarkIcon), mode: 'mask' },
  delBookMark: { src: toDataUri(delBookMarkIcon), mode: 'mask' },
  comment: { src: toDataUri(commentIcon), mode: 'mask' },
  draw: { src: toDataUri(drawIcon), mode: 'mask' },
  default: { src: toDataUri(defaultIcon), mode: 'mask' },
}

export const getIconDefinition = (name: IconName): IconDefinition => iconRegistry[name]
