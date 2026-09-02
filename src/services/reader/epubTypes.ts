export interface EpubTocItem {
  id?: string
  href: string
  label: string
  subitems?: EpubTocItem[]
}

export interface EpubNavigationItem {
  href: string
  label?: string
  parent?: string
  subitems?: EpubNavigationItem[]
}

export interface EpubManifestItem {
  href: string
  type?: string
}

export interface EpubBookLike {
  ready?: Promise<unknown>
  loaded?: {
    metadata?: Promise<{ title?: string }>
  }
  packaging?: {
    manifest?: Record<string, EpubManifestItem>
  }
  archive?: {
    getBlob?: (url: string, mimeType?: string) => Promise<Blob>
  }
  resolve?: (path: string) => string
  navigation?: {
    toc?: EpubTocItem[]
    get?: (target: string) => EpubNavigationItem | undefined
  }
  section?: {
    (target: string): EpubSectionLike | undefined
    (target: number): EpubSectionLike | undefined
  }
  load?: (path: string) => Promise<object>
  /** epub.js 原生 spine，遍历它即可对整本书做全文检索。 */
  spine?: EpubSpineLike
  locations?: {
    load: (locations: string) => void
    generate: (breakSize: number) => Promise<unknown>
    percentageFromCfi: (cfi: string) => number
  }
  destroy?: () => void
}

export interface EpubSectionLike {
  href?: string
  document?: Document
  contents?: Element
  load: (loader: (path: string) => Promise<object>) => Promise<unknown> | unknown
  cfiFromRange: (range: Range) => string
}

/** epub.js 原生 `Section#search` 返回的匹配项。 */
export interface EpubSectionMatch {
  cfi: string
  excerpt: string
}

export interface EpubSpineItemLike extends EpubSectionLike {
  index?: number
  linear?: boolean
  /** epub.js 原生 `Section#search`：在章节文档中检索文本，返回命中位置与上下文片段。 */
  search?: (query: string, maxSeqEle?: number) => EpubSectionMatch[]
}

/**
 * epub.js spine 的结构化描述。
 *
 * 注意：epub.js 自带的 `Spine` 类型声明缺少 `spineItems`，这里全部字段都是可选的，
 * 既保证运行时的 `book.spine` 仍能赋值给 `EpubBookLike`，也保留了检索所需的字段。
 */
export interface EpubSpineLike {
  spineItems?: EpubSpineItemLike[]
  get?: (target?: string | number) => EpubSpineItemLike | undefined
}

export interface EpubLocationLike {
  start?: {
    cfi?: string
    href?: string
    percentage?: number
  }
}

export interface EpubContentsLike {
  document?: Document
  window: Window
  addStylesheetCss?: (serializedCss: string, key: string) => Promise<boolean> | boolean
}

export interface EpubRenditionLike {
  book?: EpubBookLike
  annotations: {
    add: (
      type: string,
      cfiRange: string,
      data?: unknown,
      callback?: unknown,
      className?: string,
      styles?: Record<string, string>,
    ) => void
    remove: (cfiRange: string, type: string) => void
  }
  currentLocation?: () => EpubLocationLike | Promise<EpubLocationLike>
  prev?: () => Promise<unknown> | unknown
  next?: () => Promise<unknown> | unknown
  display: (target?: string | number) => Promise<unknown>
  destroy: () => void
  hooks: {
    content: {
      clear?: () => void
      deregister?: (callback: (contents: EpubContentsLike) => unknown) => void
      register: (callback: (contents: EpubContentsLike) => unknown) => unknown
    }
  }
  on: (eventName: string, callback: (...args: unknown[]) => void) => void
  getContents?: () => EpubContentsLike[]
  flow: (flow: string) => void
  layout: (settings: unknown) => void
  resize?: (width?: number, height?: number) => void
}
