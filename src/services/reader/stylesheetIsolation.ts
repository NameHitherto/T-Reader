import { getFootnoteBaseStyles } from '@/services/reader/epubStyle'
import type { EpubContentsLike, EpubRenditionLike } from '@/types/epub'

interface EpubSpineContentHook {
  register: (hook: (document: Document) => void) => void
  deregister: (hook: (document: Document) => void) => void
}

interface EpubBookLike {
  spine?: {
    hooks?: {
      content?: EpubSpineContentHook
    }
  }
}

export interface EpubBuiltInStylesheetIsolationController {
  disableBuiltInStylesheet: () => void
  enableBuiltInStylesheet: () => void
  setCustomStylesheet: (css: string) => void
  bindRendition: (rendition: EpubRenditionLike) => void
  destroy: () => void
}

const CUSTOM_STYLESHEET_KEY = 't-reader-theme'

export const createEpubBuiltInStylesheetIsolationController = (
  book: EpubBookLike,
): EpubBuiltInStylesheetIsolationController => {
  const contentHook = book.spine?.hooks?.content
  let isRegistered = false
  let renditionContentHook: ((contents: EpubContentsLike) => unknown) | undefined
  let isRenditionThemeRegistered = false
  let customStylesheetCss = ''
  let boundRendition: EpubRenditionLike | null = null

  const FOOTNOTE_STYLE_ID = 't-reader-footnote-styles'

  const injectFootnoteStyles = (doc: Document) => {
    if (doc.getElementById(FOOTNOTE_STYLE_ID)) return

    const style = doc.createElement('style')
    style.id = FOOTNOTE_STYLE_ID
    style.textContent = getFootnoteBaseStyles()
    doc.head?.appendChild(style)
  }

  const stripBuiltInStylesheetHook = (doc: Document) => {
    const nodes = doc.querySelectorAll("link[rel~='stylesheet'], style")
    nodes.forEach((node) => node.remove())
    injectFootnoteStyles(doc)
  }

  const applyThemeToContents = async (contents: EpubContentsLike) => {
    if (!customStylesheetCss || !contents.addStylesheetCss) return contents

    try {
      await contents.addStylesheetCss(customStylesheetCss, CUSTOM_STYLESHEET_KEY)
    } catch {
      // A destroyed or not-yet-ready iframe must not interrupt rendition hooks.
    }

    return contents
  }

  const applyThemeToCurrentContents = () => {
    const contents = boundRendition?.getContents?.() || []
    contents.forEach((content) => {
      void applyThemeToContents(content)
    })
  }

  const disableBuiltInStylesheet = () => {
    if (!contentHook || isRegistered) return
    contentHook.register(stripBuiltInStylesheetHook)
    isRegistered = true
  }

  const enableBuiltInStylesheet = () => {
    if (!contentHook || !isRegistered) return
    contentHook.deregister(stripBuiltInStylesheetHook)
    isRegistered = false
  }

  const bindRendition = (rendition: EpubRenditionLike) => {
    if (boundRendition === rendition) return

    if (renditionContentHook && boundRendition?.hooks?.content) {
      boundRendition.hooks.content.deregister?.(renditionContentHook)
    }

    boundRendition = rendition
    renditionContentHook = applyThemeToContents
    rendition.hooks?.content?.register(renditionContentHook)
    isRenditionThemeRegistered = Boolean(rendition.hooks?.content)
    applyThemeToCurrentContents()
  }

  const setCustomStylesheet = (css: string) => {
    customStylesheetCss = css
    applyThemeToCurrentContents()
  }

  const destroy = () => {
    if (renditionContentHook && boundRendition?.hooks?.content && isRenditionThemeRegistered) {
      boundRendition.hooks.content.deregister?.(renditionContentHook)
    }
    renditionContentHook = undefined
    boundRendition = null
    isRenditionThemeRegistered = false
    enableBuiltInStylesheet()
  }

  return {
    disableBuiltInStylesheet,
    enableBuiltInStylesheet,
    setCustomStylesheet,
    bindRendition,
    destroy,
  }
}
