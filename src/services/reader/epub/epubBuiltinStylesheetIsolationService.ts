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
  destroy: () => void
}

const removeBuiltInStylesheetNodes = (doc: Document) => {
  const nodes = doc.querySelectorAll("link[rel~='stylesheet'], style")
  nodes.forEach((node) => node.remove())
}

export const createEpubBuiltInStylesheetIsolationController = (
  book: EpubBookLike
): EpubBuiltInStylesheetIsolationController => {
  const contentHook = book.spine?.hooks?.content
  let isRegistered = false

  const stripBuiltInStylesheetHook = (doc: Document) => {
    removeBuiltInStylesheetNodes(doc)
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

  const destroy = () => {
    enableBuiltInStylesheet()
  }

  return {
    disableBuiltInStylesheet,
    enableBuiltInStylesheet,
    destroy,
  }
}
