import { logWarn } from '@/utils/logger'
import { resolveEpubTocLabel } from './epubProgress'
import type { EpubBookLike, EpubRenditionLike, EpubTocItem } from './epubTypes'

/** 搜索命中高亮使用的 className（epub.js 的 SVG 覆盖层元素）。 */
export const SEARCH_HIGHLIGHT_CLASS = 'search-highlight'

/** 单次搜索返回的最大命中数，避免超大书籍把界面拖垮。 */
export const DEFAULT_SEARCH_MAX_RESULTS = 200

/**
 * 传给 epub.js 原生 `Section#search` 的 maxSeqEle：
 * 表示检索时最多合并多少个相邻文本节点，用于命中跨节点的短语。
 */
const SEARCH_SEQUENCE_ELEMENTS = 5

/** 每扫描多少个 section 主动让出一次主线程，保证搜索过程中界面仍可响应。 */
const SEARCH_YIELD_INTERVAL = 4

const SEARCH_HIGHLIGHT_STYLES: Record<string, string> = {
  fill: '#f59e0b',
  'fill-opacity': '0.35',
  'mix-blend-mode': 'normal',
}

export interface ReaderSearchHit {
  id: string
  /** epub.js 生成的 CFI range，可直接用于跳转与高亮 */
  cfi: string
  excerpt: string
  chapterTitle: string
  sectionHref: string
  sectionIndex: number
}

export interface SearchBookOptions {
  /** 命中上限，达到后停止继续扫描后续章节 */
  maxResults?: number
  /** 返回 true 时立即中断搜索（用于取消上一次输入触发的搜索） */
  isCancelled?: () => boolean
  /** 每扫描完一个 section 回调一次，参数为已扫描数与总数 */
  onProgress?: (scanned: number, total: number) => void
  /** 每扫描完一个 section 回调一次，用于流式追加结果 */
  onSectionMatches?: (matches: ReaderSearchHit[]) => void
}

const yieldToUi = (): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, 0)
  })

const resolveChapterTitle = (
  tocItems: EpubTocItem[],
  sectionHref: string,
  sectionIndex: number,
): string => {
  return resolveEpubTocLabel(tocItems, sectionHref) || `第 ${sectionIndex + 1} 节`
}

/**
 * 使用 epub.js 原生 `Section#search` 遍历全书 spine 做全文检索。
 *
 * epub.js 没有 Book 级别的搜索入口，因此这里按 spine 顺序逐个加载章节文档
 * 并调用章节自带的搜索能力，再把命中的 CFI 与上下文片段组装成结果列表。
 */
export const searchBook = async (
  book: EpubBookLike | null | undefined,
  query: string,
  options: SearchBookOptions = {},
): Promise<ReaderSearchHit[]> => {
  const keyword = query.trim()
  const hits: ReaderSearchHit[] = []

  if (!keyword || !book?.load || !book.spine?.spineItems?.length) {
    return hits
  }

  const {
    maxResults = DEFAULT_SEARCH_MAX_RESULTS,
    isCancelled,
    onProgress,
    onSectionMatches,
  } = options

  if (maxResults <= 0) {
    return hits
  }

  const tocItems = book.navigation?.toc || []
  const loader = book.load.bind(book)
  const spineItems = book.spine.spineItems
  const total = spineItems.length
  let scanned = 0

  for (const section of spineItems) {
    if (isCancelled?.() || hits.length >= maxResults) {
      return hits
    }

    scanned += 1

    // 非线性章节（如导航文档）不属于正文，跳过
    if (section.linear === false) {
      continue
    }

    try {
      await section.load(loader)
    } catch (error) {
      logWarn('reader-search', 'load-section-failed', error)
      continue
    }

    if (isCancelled?.()) {
      return hits
    }

    const matches = (() => {
      try {
        return section.search?.(keyword, SEARCH_SEQUENCE_ELEMENTS) || []
      } catch (error) {
        logWarn('reader-search', 'search-section-failed', error)
        return []
      }
    })()

    if (matches.length > 0) {
      const sectionIndex = section.index ?? -1
      const sectionHref = section.href || ''
      const chapterTitle = resolveChapterTitle(tocItems, sectionHref, sectionIndex)
      const sectionHits = matches.map((match) => ({
        id: match.cfi,
        cfi: match.cfi,
        excerpt: match.excerpt,
        chapterTitle,
        sectionHref,
        sectionIndex,
      }))

      hits.push(...sectionHits)
      onSectionMatches?.(sectionHits)
    }

    onProgress?.(scanned, total)

    if (scanned % SEARCH_YIELD_INTERVAL === 0) {
      await yieldToUi()
    }
  }

  return hits
}

/** 用 epub.js 原生 annotations 给指定 CFI 加高亮。 */
export const addSearchHighlight = (rendition: EpubRenditionLike | null, cfi: string): void => {
  if (!rendition || !cfi) {
    return
  }

  rendition.annotations.remove(cfi, 'highlight')
  rendition.annotations.add(
    'highlight',
    cfi,
    { searchHit: true },
    undefined,
    SEARCH_HIGHLIGHT_CLASS,
    { ...SEARCH_HIGHLIGHT_STYLES },
  )
}

/** 移除指定 CFI 上的搜索高亮。 */
export const removeSearchHighlight = (rendition: EpubRenditionLike | null, cfi: string): void => {
  if (!rendition || !cfi) {
    return
  }

  rendition.annotations.remove(cfi, 'highlight')
}

/** 批量移除搜索高亮。 */
export const clearSearchHighlights = (
  rendition: EpubRenditionLike | null,
  cfis: string[],
): void => {
  if (!rendition) {
    return
  }

  for (const cfi of cfis) {
    rendition.annotations.remove(cfi, 'highlight')
  }
}
