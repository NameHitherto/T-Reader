interface EpubContentHook {
  register: (hook: (document: Document) => void) => void
  deregister: (hook: (document: Document) => void) => void
}

interface EpubBookLike {
  spine?: {
    hooks?: {
      content?: EpubContentHook
    }
  }
}

export interface EpubBuiltInStylesheetIsolationController {
  disableBuiltInStylesheet: () => void
  enableBuiltInStylesheet: () => void
  setCustomStylesheet: (css: string) => void
  destroy: () => void
}

const CUSTOM_STYLESHEET_ID = 't-reader-custom-stylesheet'

const removeBuiltInStylesheetNodes = (doc: Document) => {
  const nodes = doc.querySelectorAll("link[rel~='stylesheet'], style")
  nodes.forEach((node) => node.remove())
}

const insertCustomStylesheetNode = (doc: Document, css: string) => {
  const head = doc.head || doc.getElementsByTagName('head')[0]
  if (!head) {
    return
  }

  const existingStyle = doc.getElementById(CUSTOM_STYLESHEET_ID) as HTMLStyleElement | null

  if (!css) {
    existingStyle?.remove()
    return
  }

  const styleElement = existingStyle || doc.createElement('style')
  styleElement.id = CUSTOM_STYLESHEET_ID

  if (styleElement.textContent !== css) {
    styleElement.textContent = css
  }

  if (!styleElement.isConnected) {
    head.appendChild(styleElement)
  }
}

export const createEpubBuiltInStylesheetIsolationController = (
  book: EpubBookLike,
): EpubBuiltInStylesheetIsolationController => {
  const contentHook = book.spine?.hooks?.content
  let isRegistered = false
  let isCustomStylesheetRegistered = false
  let customStylesheetCss = ''

  const stripBuiltInStylesheetHook = (doc: Document) => {
    removeBuiltInStylesheetNodes(doc)
  }

  const customStylesheetHook = (doc: Document) => {
    insertCustomStylesheetNode(doc, customStylesheetCss)
  }

  const disableBuiltInStylesheet = () => {
    if (!contentHook || isRegistered) {
      return
    }

    contentHook.register(stripBuiltInStylesheetHook)
    isRegistered = true
  }

  const enableBuiltInStylesheet = () => {
    if (!contentHook || !isRegistered) {
      return
    }

    contentHook.deregister(stripBuiltInStylesheetHook)
    isRegistered = false
  }

  const setCustomStylesheet = (css: string) => {
    customStylesheetCss = css

    if (!contentHook || isCustomStylesheetRegistered) {
      return
    }

    contentHook.register(customStylesheetHook)
    isCustomStylesheetRegistered = true
  }

  const removeCustomStylesheet = () => {
    if (!contentHook || !isCustomStylesheetRegistered) {
      return
    }

    contentHook.deregister(customStylesheetHook)
    isCustomStylesheetRegistered = false
  }

  const destroy = () => {
    removeCustomStylesheet()
    enableBuiltInStylesheet()
  }

  return {
    disableBuiltInStylesheet,
    enableBuiltInStylesheet,
    setCustomStylesheet,
    destroy,
  }
}
