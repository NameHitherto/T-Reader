import addBookIcon from '@/assets/addBook.svg'
import refreshIcon from '@/assets/refresh.svg'
import settingIcon from '@/assets/setting.svg'
import listViewIcon from '@/assets/icons/list-view.svg'
import gridViewIcon from '@/assets/icons/grid-view.svg'
import sidebarBookshelfIcon from '@/assets/icons/sidebar-bookshelf.svg'
import sidebarNoteIcon from '@/assets/icons/sidebar-note.svg'
import sidebarGalleryIcon from '@/assets/icons/sidebar-gallery.svg'
import sidebarAboutIcon from '@/assets/icons/sidebar-about.svg'
import contactBilibiliIcon from '@/assets/icons/contact-bilibili.svg'
import contactGithubIcon from '@/assets/icons/contact-github.svg'
import contactEmailIcon from '@/assets/icons/contact-email.svg'

import bookOpenIcon from '@/components/ContextMenu/assets/book-open.svg'
import uploadIcon from '@/components/ContextMenu/assets/upload.svg'
import deleteIcon from '@/components/ContextMenu/assets/delete.svg'
import goBackIcon from '@/components/ContextMenu/assets/go-back.svg'
import infoIcon from '@/components/ContextMenu/assets/info.svg'
import editIcon from '@/components/ContextMenu/assets/edit.svg'
import bookmarkIcon from '@/components/ContextMenu/assets/bookmark.svg'
import delBookMarkIcon from '@/components/ContextMenu/assets/delBookMark.svg'
import commentIcon from '@/components/ContextMenu/assets/comment.svg'
import drawIcon from '@/components/ContextMenu/assets/draw.svg'
import defaultIcon from '@/components/ContextMenu/assets/default.svg'

export type IconRenderMode = 'mask' | 'image'

export type IconName =
  | 'addBook'
  | 'refresh'
  | 'setting'
  | 'listView'
  | 'gridView'
  | 'sidebarBookshelf'
  | 'sidebarNote'
  | 'sidebarGallery'
  | 'sidebarAbout'
  | 'contactBilibili'
  | 'contactGithub'
  | 'contactEmail'
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

const iconRegistry: Record<IconName, IconDefinition> = {
  addBook: { src: addBookIcon, mode: 'mask' },
  refresh: { src: refreshIcon, mode: 'mask' },
  setting: { src: settingIcon, mode: 'mask' },
  listView: { src: listViewIcon, mode: 'mask' },
  gridView: { src: gridViewIcon, mode: 'mask' },
  sidebarBookshelf: { src: sidebarBookshelfIcon, mode: 'mask' },
  sidebarNote: { src: sidebarNoteIcon, mode: 'mask' },
  sidebarGallery: { src: sidebarGalleryIcon, mode: 'mask' },
  sidebarAbout: { src: sidebarAboutIcon, mode: 'mask' },
  contactBilibili: { src: contactBilibiliIcon, mode: 'mask' },
  contactGithub: { src: contactGithubIcon, mode: 'mask' },
  contactEmail: { src: contactEmailIcon, mode: 'mask' },
  bookOpen: { src: bookOpenIcon, mode: 'mask' },
  upload: { src: uploadIcon, mode: 'mask' },
  delete: { src: deleteIcon, mode: 'mask' },
  goBack: { src: goBackIcon, mode: 'mask' },
  info: { src: infoIcon, mode: 'mask' },
  edit: { src: editIcon, mode: 'mask' },
  bookmark: { src: bookmarkIcon, mode: 'mask' },
  delBookMark: { src: delBookMarkIcon, mode: 'mask' },
  comment: { src: commentIcon, mode: 'mask' },
  draw: { src: drawIcon, mode: 'mask' },
  default: { src: defaultIcon, mode: 'mask' },
}

export const getIconDefinition = (name: IconName): IconDefinition => iconRegistry[name]
