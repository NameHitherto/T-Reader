/**
 * Legado HTML 格式化器
 *
 * 复刻 Legado 项目中 HtmlFormatter.formatKeepImg() 的转换逻辑，
 * 用于在 epub.js 的 DOM CFI 与 Legado 的 durChapterPos（纯文本字符偏移）之间建立高精度映射。
 *
 * Legado 的格式化流程（参考 io.legado.app.utils.HtmlFormatter）：
 * 1. 移除 script/style/title、HTML 注释、display:none 元素
 * 2. 将 div/p/br/hr/h1-h6/article/dd/dl 替换为 \n
 * 3. 剥离其他 HTML 标签（保留 img）
 * 4. 替换 HTML 实体（&nbsp; 等）
 * 5. 规范化空白和段落缩进
 */

import type { EpubSectionLike } from '@/types/epub'

const LEGADO_PARAGRAPH_INDENT = '\u3000\u3000'
const ZERO_WIDTH_CHARS = new RegExp(
  // eslint-disable-next-line no-misleading-character-class
  `[${['\\u2009', '\\u200B', '\\u200C', '\\u200D', '\\uFEFF'].join('')}]`,
  'g',
)

const getSectionRoot = (section: EpubSectionLike): Element | null => {
  return section?.document?.body || section?.contents || section?.document?.documentElement || null
}

const BLOCK_TAGS = new Set(['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'article', 'dd', 'dl'])

const VOID_NEWLINE_TAGS = new Set(['br', 'hr'])

const SKIP_TAGS = new Set(['script', 'style', 'title'])

/**
 * 移除不需要的节点：script/style/title、HTML 注释、display:none 元素
 */
const removeUnwantedNodes = (root: Node): void => {
  const doc = root.ownerDocument
  if (!doc) return

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT, null)

  const toRemove: Node[] = []
  let node: Node | null

  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.COMMENT_NODE) {
      toRemove.push(node)
      continue
    }

    const el = node as Element
    const tag = el.tagName.toLowerCase()

    if (SKIP_TAGS.has(tag)) {
      toRemove.push(el)
      continue
    }

    const display = (el as HTMLElement).style?.display
    if (display === 'none') {
      toRemove.push(el)
    }
  }

  toRemove.forEach((n) => {
    n.parentNode?.removeChild(n)
  })
}

/**
 * 转换元素节点：
 * - div/p/h1-h6 等：在开标签前和闭标签后插入 \n，然后解包子节点
 * - br/hr：替换为 \n 文本节点
 * - img：保留
 * - 其他：直接解包子节点
 */
const transformElements = (root: Node): void => {
  const doc = root.ownerDocument
  if (!doc) return

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  const elements: Element[] = []
  let node: Node | null

  while ((node = walker.nextNode())) {
    elements.push(node as Element)
  }

  for (const el of elements) {
    if (!el.parentNode) continue

    const tag = el.tagName.toLowerCase()
    if (tag === 'img') continue

    const parent = el.parentNode

    // br/hr 是空元素，只产生一个换行
    if (VOID_NEWLINE_TAGS.has(tag)) {
      parent.insertBefore(doc.createTextNode('\n'), el)
      parent.removeChild(el)
      continue
    }

    const needsNewlines = BLOCK_TAGS.has(tag)

    if (needsNewlines) {
      parent.insertBefore(doc.createTextNode('\n'), el)
    }

    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el)
    }

    if (needsNewlines) {
      parent.insertBefore(doc.createTextNode('\n'), el)
    }

    parent.removeChild(el)
  }
}

/**
 * 处理文本内容中的特殊字符
 */
const processTextContent = (text: string): string => {
  return text
    .replace(/\u00A0/g, ' ') // &nbsp;
    .replace(/[\u2003\u2002]/g, ' ') // &emsp; &ensp;
    .replace(ZERO_WIDTH_CHARS, '') // thinsp, zwnj, zwj, zwsp, BOM
}

/**
 * 规范化 Legado 文本：
 * 1. 将换行周围的空白压缩为 \n
 * 2. 开头空白压缩为
 * 3. 去掉末尾空白
 */
const normalizeLegadoText = (text: string): string => {
  return text
    .replace(/\s*\n+\s*/g, `\n${LEGADO_PARAGRAPH_INDENT}`)
    .replace(/^\s+/, LEGADO_PARAGRAPH_INDENT)
    .replace(/\s+$/, '')
}

/**
 * 将 DOM fragment 转换为 Legado 格式的纯文本
 */
export const domToLegadoText = (root: Node): string => {
  removeUnwantedNodes(root)
  transformElements(root)

  const doc = root.ownerDocument
  if (!doc) return ''

  const segments: string[] = []
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as Element).tagName.toLowerCase()

        return tag === 'img' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let node: Node | null
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const img = node as HTMLImageElement
      const src = img.getAttribute('src') || ''
      segments.push(`<img src="${src}">`)
    } else {
      segments.push(processTextContent(node.textContent || ''))
    }
  }

  return normalizeLegadoText(segments.join(''))
}

/**
 * 计算 targetRange 起点在 Legado 格式化文本中的字符偏移量
 */
export const calculateLegadoOffset = (section: EpubSectionLike, targetRange: Range): number => {
  const doc = section?.document as Document | undefined
  const root = getSectionRoot(section)
  if (!doc || !root) {
    return 0
  }

  const prefixRange = doc.createRange()
  prefixRange.setStart(root, 0)
  prefixRange.setEnd(targetRange.startContainer, targetRange.startOffset)

  const fragment = prefixRange.cloneContents()

  return domToLegadoText(fragment).length
}

/**
 * 收集指定根节点下所有有效的文本节点（排除 script/style/title 内）
 */
const collectTextNodes = (root: Element): Text[] => {
  const textNodes: Text[] = []
  const doc = root.ownerDocument
  if (!doc) return textNodes

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      let parent = node.parentElement
      while (parent && parent !== root) {
        const tag = parent.tagName.toLowerCase()
        if (SKIP_TAGS.has(tag)) {
          return NodeFilter.FILTER_REJECT
        }
        parent = parent.parentElement
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let node: Node | null
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text)
  }
  return textNodes
}

/**
 * 根据 Legado 格式的字符偏移量在 DOM 中重建 Range
 */
export const createRangeFromLegadoOffset = (
  section: EpubSectionLike,
  chapterOffset: number,
): Range | null => {
  const doc = section?.document as Document | undefined
  const root = getSectionRoot(section)
  if (!doc || !root) {
    return null
  }

  const safeOffset = Math.max(0, Math.floor(chapterOffset))
  const textNodes = collectTextNodes(root)

  if (textNodes.length === 0) {
    const range = doc.createRange()
    range.setStart(root, 0)
    range.collapse(true)
    return range
  }

  const prefixRange = doc.createRange()
  prefixRange.setStart(root, 0)

  // 二分搜索定位到目标 text 节点
  let left = 0
  let right = textNodes.length - 1

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const testNode = textNodes[mid]
    prefixRange.setEndAfter(testNode)
    const len = domToLegadoText(prefixRange.cloneContents()).length

    if (len <= safeOffset) {
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  const targetNodeIndex = Math.min(left, textNodes.length - 1)
  const targetNode = textNodes[targetNodeIndex]

  // 计算目标节点之前的精确长度
  prefixRange.setEndBefore(targetNode)
  const prefixLen = domToLegadoText(prefixRange.cloneContents()).length

  if (prefixLen === safeOffset) {
    const range = doc.createRange()
    range.setStart(targetNode, 0)
    range.collapse(true)
    return range
  }

  // 如果目标偏移在前一个节点末尾（由于空白规范化，prefixLen 可能大于 safeOffset）
  if (prefixLen > safeOffset && targetNodeIndex > 0) {
    const prevNode = textNodes[targetNodeIndex - 1]
    prefixRange.setEndAfter(prevNode)
    const prevLen = domToLegadoText(prefixRange.cloneContents()).length
    if (prevLen <= safeOffset) {
      // 偏移落在前一个节点和当前节点之间的空白/换行区域
      // 保守策略：回到前一个节点末尾
      const range = doc.createRange()
      range.setStartAfter(prevNode)
      range.collapse(true)
      return range
    }
  }

  // 在目标节点内部二分搜索精确偏移
  const nodeText = targetNode.textContent || ''
  let nodeLeft = 0
  let nodeRight = nodeText.length

  while (nodeLeft < nodeRight) {
    const nodeMid = Math.ceil((nodeLeft + nodeRight) / 2)
    prefixRange.setEnd(targetNode, nodeMid)
    const len = domToLegadoText(prefixRange.cloneContents()).length

    if (len <= safeOffset) {
      nodeLeft = nodeMid
    } else {
      nodeRight = nodeMid - 1
    }
  }

  const range = doc.createRange()
  range.setStart(targetNode, nodeLeft)
  range.collapse(true)
  return range
}
