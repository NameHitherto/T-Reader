import {
  filterDocumentStylesheets,
  type EpubBookContext,
  type EpubSectionContext,
} from '@/services/reader/epubCssFilter'
import type { EpubContentsLike, EpubRenditionLike } from '@/services/reader/epubTypes'

interface EpubSpineContentHook {
  register: (hook: (document: Document, section?: EpubSectionContext) => void) => void
  deregister: (hook: (document: Document, section?: EpubSectionContext) => void) => void
}

interface EpubBookLike extends EpubBookContext {
  spine?: {
    hooks?: {
      content?: EpubSpineContentHook
    }
  }
}

export interface EpubBuiltInStylesheetIsolationController {
  disableBuiltInStylesheet: () => void
  enableBuiltInStylesheet: () => void
  filterBuiltInStylesheet: () => void
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
  let registeredBuiltInStylesheetHook:
    | ((doc: Document, section?: EpubSectionContext) => unknown)
    | null = null
  let renditionContentHook: ((contents: EpubContentsLike) => unknown) | undefined
  let isRenditionThemeRegistered = false
  let customStylesheetCss = ''
  let boundRendition: EpubRenditionLike | null = null

  const stripBuiltInStylesheetHook = (doc: Document) => {
    const nodes = doc.querySelectorAll("link[rel~='stylesheet'], style")
    nodes.forEach((node) => node.remove())
  }

  const filterBuiltInStylesheetHook = async (doc: Document, section?: EpubSectionContext) => {
    await filterDocumentStylesheets(doc, section, book)
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
    registeredBuiltInStylesheetHook = stripBuiltInStylesheetHook
    isRegistered = true
  }

  const filterBuiltInStylesheet = () => {
    if (!contentHook || isRegistered) return
    contentHook.register(filterBuiltInStylesheetHook)
    registeredBuiltInStylesheetHook = filterBuiltInStylesheetHook
    isRegistered = true
  }

  const enableBuiltInStylesheet = () => {
    if (!contentHook || !isRegistered) return
    if (registeredBuiltInStylesheetHook) {
      contentHook.deregister(registeredBuiltInStylesheetHook)
    }
    registeredBuiltInStylesheetHook = null
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
    filterBuiltInStylesheet,
    setCustomStylesheet,
    bindRendition,
    destroy,
  }
}
