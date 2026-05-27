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

export interface EpubBookLike {
  ready?: Promise<unknown>
  loaded?: {
    metadata?: Promise<{ title?: string }>
  }
  navigation?: {
    toc?: EpubTocItem[]
    get?: (target: string) => EpubNavigationItem | undefined
  }
  section?: {
    (target: string): EpubSectionLike | undefined
    (target: number): EpubSectionLike | undefined
  }
  load?: (path: string) => Promise<object>
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
      deregister?: (callback: (contents: EpubContentsLike) => EpubContentsLike) => void
      register: (callback: (contents: EpubContentsLike) => EpubContentsLike) => unknown
    }
  }
  on: (eventName: string, callback: (...args: unknown[]) => void) => void
  getContents?: () => EpubContentsLike[]
  themes: {
    default: (theme: Record<string, unknown>) => void
  }
  flow: (flow: string) => void
  layout: (settings: unknown) => void
}
