/** CSS filtering used by the EPUB built-in stylesheet smart mode. */

export interface EpubArchiveLike {
  getText?: (path: string, encoding?: string) => Promise<string>
  request?: (url: string, type?: string) => Promise<unknown>
  zip?: {
    file: (path: string) => { async: (type: string) => Promise<string> } | null
  }
}

export interface EpubBookContext {
  archive?: EpubArchiveLike
  load?: (path: string, type?: string) => Promise<unknown>
  resolve?: (path: string, absolute?: boolean) => string
  resources?: {
    get?: (path: string) => Promise<string> | string
  }
}

export interface EpubSectionContext {
  url?: string
  href?: string
}

const splitSelectorList = (value: string): string[] => {
  const result: string[] = []
  let start = 0
  let depth = 0
  let quote = ''
  let escaped = false

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (quote) {
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
    } else if (char === '[' || char === '(') {
      depth += 1
    } else if (char === ']' || char === ')') {
      depth = Math.max(0, depth - 1)
    } else if (char === ',' && depth === 0) {
      result.push(value.slice(start, index).trim())
      start = index + 1
    }
  }
  result.push(value.slice(start).trim())
  return result.filter(Boolean)
}

const isAllowedSelector = (selector: string): boolean => {
  const value = selector.trim()
  let index = 0
  let firstCompound = true

  const skipWhitespace = () => {
    const start = index
    while (/\s/.test(value[index] || '')) index += 1
    return index > start
  }

  while (index < value.length) {
    const hadWhitespace = skipWhitespace()
    if (!firstCompound) {
      const combinator = value[index]
      if (combinator === '>' || combinator === '+' || combinator === '~') {
        index += 1
        skipWhitespace()
      } else if (!hadWhitespace) {
        return false
      }
    }

    let compoundParts = 0
    while (index < value.length) {
      const char = value[index]
      if (char === '.' || char === '#') {
        index += 1
        const nameStart = index
        while (index < value.length && /[\w-]/.test(value[index])) index += 1
        if (index === nameStart) return false
        compoundParts += 1
        continue
      }
      if (char === '[') {
        let depth = 1
        let quote = ''
        let escaped = false
        index += 1
        while (index < value.length && depth > 0) {
          const current = value[index++]
          if (escaped) escaped = false
          else if (current === '\\') escaped = true
          else if (quote) {
            if (current === quote) quote = ''
          } else if (current === '"' || current === "'") quote = current
          else if (current === '[') depth += 1
          else if (current === ']') depth -= 1
        }
        if (depth !== 0 || quote) return false
        compoundParts += 1
        continue
      }
      break
    }
    if (compoundParts === 0) return false
    firstCompound = false
  }

  return !firstCompound
}

const serializeDeclarations = (style: CSSStyleDeclaration, doc?: Document): string => {
  const hostDoc = doc?.defaultView?.document || (typeof document !== 'undefined' ? document : doc)
  const probe = hostDoc?.createElement('span').style
  if (!probe) return style.cssText
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index)
    if (!property || property.startsWith('--') || property === 'font' || property === 'font-family')
      continue
    const value = style.getPropertyValue(property)
    const priority = style.getPropertyPriority(property)
    try {
      probe.setProperty(property, value, priority)
    } catch {
      // Ignore declarations rejected by the browser CSS parser.
    }
  }
  return probe.cssText
}

export const filterCssText = (cssText: string, doc?: Document): string => {
  if (!cssText.trim()) return ''

  let rules: CSSRuleList | undefined
  if (typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype) {
    try {
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(cssText)
      rules = sheet.cssRules
    } catch {
      // Fallback to DOM probe
    }
  }

  if (!rules) {
    const hostDoc = doc?.defaultView?.document || (typeof document !== 'undefined' ? document : doc)
    if (!hostDoc) return ''
    const probe = hostDoc.createElement('style')
    probe.textContent = cssText
    const targetParent = hostDoc.head || hostDoc.documentElement
    if (!targetParent) return ''
    targetParent.appendChild(probe)
    try {
      rules = probe.sheet?.cssRules
    } catch {
      probe.remove()
      return ''
    } finally {
      probe.remove()
    }
  }

  const output: string[] = []
  if (rules) {
    for (let index = 0; index < rules.length; index += 1) {
      const rule = rules[index]
      if (rule.type !== CSSRule.STYLE_RULE) continue
      const styleRule = rule as CSSStyleRule
      const selectors = splitSelectorList(styleRule.selectorText).filter(isAllowedSelector)
      const declarations = serializeDeclarations(styleRule.style, doc)
      if (selectors.length && declarations) {
        output.push(`${selectors.join(', ')} { ${declarations} }`)
      }
    }
  }
  return output.join('\n')
}

const resolvePath = (base: string, relative: string): string => {
  if (!base) return relative.startsWith('/') ? relative : `/${relative}`
  try {
    const fakeOrigin = 'http://localhost'
    const normalizedBase = base.startsWith('/') ? base : `/${base}`
    const url = new URL(relative, `${fakeOrigin}${normalizedBase}`)

    return url.pathname
  } catch {
    return relative.startsWith('/') ? relative : `/${relative}`
  }
}

export const readStylesheet = async (
  link: HTMLLinkElement | Element,
  section?: EpubSectionContext | null,
  book?: EpubBookContext | null,
  doc?: Document | null,
): Promise<string> => {
  const rawHref = link.getAttribute('href') || (link as HTMLLinkElement).href || ''
  if (!rawHref.trim()) return ''

  // 1. Direct fetch for blob/data URLs or external http(s) URLs
  if (rawHref.startsWith('blob:') || rawHref.startsWith('data:') || /^https?:\/\//i.test(rawHref)) {
    try {
      const response = await fetch(rawHref)
      if (response.ok) {
        return await response.text()
      }
    } catch {
      // Fallback to book/archive resolution
    }
  }

  // 2. Clean query params and hash from the path
  const cleanHref = rawHref.split('?')[0].split('#')[0].trim()
  if (!cleanHref) return ''

  // 3. Resolve possible relative and absolute paths within the EPUB
  const baseCandidates: string[] = []
  if (section?.url) baseCandidates.push(section.url)
  const baseTagHref = doc?.querySelector('base')?.getAttribute('href')
  if (baseTagHref) baseCandidates.push(baseTagHref)
  if (section?.href) baseCandidates.push(section.href)
  if (baseCandidates.length === 0) baseCandidates.push('/')

  const pathCandidates = new Set<string>()

  for (const base of baseCandidates) {
    const resolved = resolvePath(base, cleanHref)
    pathCandidates.add(resolved)
    pathCandidates.add(resolved.replace(/^\/+/, ''))
    try {
      const decoded = decodeURIComponent(resolved)
      pathCandidates.add(decoded)
      pathCandidates.add(decoded.replace(/^\/+/, ''))
    } catch {
      // Ignore URI decoding errors
    }
  }

  pathCandidates.add(cleanHref)
  pathCandidates.add(cleanHref.replace(/^\/+/, ''))
  try {
    const decodedHref = decodeURIComponent(cleanHref)
    pathCandidates.add(decodedHref)
    pathCandidates.add(decodedHref.replace(/^\/+/, ''))
  } catch {
    // Ignore URI decoding errors
  }

  if (book?.resolve) {
    try {
      const bookResolved = book.resolve(cleanHref)
      if (bookResolved) {
        pathCandidates.add(bookResolved)
        pathCandidates.add(bookResolved.replace(/^\/+/, ''))
      }
    } catch {
      // Ignore
    }
  }

  // 4. Try loading from book archive / JSZip directly
  if (book?.archive?.zip) {
    for (const candidate of pathCandidates) {
      const file = book.archive.zip.file(candidate)
      if (file) {
        try {
          const text = await file.async('string')
          if (typeof text === 'string') return text
        } catch {
          // Continue to next candidate
        }
      }
    }
  }

  // 5. Try book.archive.getText
  if (book?.archive?.getText) {
    for (const candidate of pathCandidates) {
      try {
        const text = await book.archive.getText(
          candidate.startsWith('/') ? candidate : `/${candidate}`,
        )
        if (typeof text === 'string' && text) return text
      } catch {
        // Continue
      }
    }
  }

  // 6. Try book.load
  if (book?.load) {
    for (const candidate of pathCandidates) {
      try {
        const result = await book.load(candidate, 'text')
        if (typeof result === 'string' && result) return result
      } catch {
        // Continue
      }
    }
  }

  // 7. Try book.resources.get
  if (book?.resources?.get) {
    for (const candidate of pathCandidates) {
      try {
        const result = await book.resources.get(candidate)
        if (typeof result === 'string' && result) {
          if (result.startsWith('data:') || result.startsWith('blob:')) {
            const res = await fetch(result)
            if (res.ok) return await res.text()
          }
          return result
        }
      } catch {
        // Continue
      }
    }
  }

  // 8. Fallback to fetch (e.g. unarchived directory or server-served assets)
  try {
    const urlToFetch = (link as HTMLLinkElement).href || rawHref
    if (urlToFetch) {
      const res = await fetch(urlToFetch)
      if (res.ok) {
        const contentType = res.headers.get('content-type') || ''
        if (!contentType.includes('text/html')) {
          const text = await res.text()
          if (text && !text.trim().startsWith('<!DOCTYPE') && !text.trim().startsWith('<html')) {
            return text
          }
        }
      }
    }
  } catch {
    // Ignore fetch errors
  }

  return ''
}

export const filterDocumentStylesheets = async (
  doc: Document,
  section?: EpubSectionContext | null,
  book?: EpubBookContext | null,
): Promise<void> => {
  const styles = Array.from(doc.querySelectorAll<HTMLStyleElement>('style'))
  const links = Array.from(
    doc.querySelectorAll<HTMLLinkElement>("link[rel~='stylesheet'], link[rel='stylesheet']"),
  )

  for (const style of styles) {
    const filtered = filterCssText(style.textContent || '', doc)
    if (filtered) {
      style.textContent = filtered
    } else {
      style.remove()
    }
  }

  for (const link of links) {
    const cssText = await readStylesheet(link, section, book, doc)
    const filtered = cssText ? filterCssText(cssText, doc) : ''
    if (filtered) {
      const ns = doc.documentElement?.namespaceURI
      const style = ns ? doc.createElementNS(ns, 'style') : doc.createElement('style')
      style.textContent = filtered
      link.replaceWith(style)
    } else {
      link.remove()
    }
  }
}
