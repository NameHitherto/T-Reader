import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { logWarn } from '@/utils/logger'
import {
  addSearchHighlight,
  clearSearchHighlights,
  DEFAULT_SEARCH_MAX_RESULTS,
  searchBook,
} from '@/services/reader/search'
import type { ReaderSearchHit } from '@/services/reader/search'
import type { EpubRenditionLike } from '@/services/reader/epubTypes'

/** 输入防抖时长：整书检索较重，避免逐字符触发。 */
const SEARCH_DEBOUNCE_MS = 320

export const useReaderSearch = (rendition: Ref<EpubRenditionLike | null>) => {
  const searchVisible = ref(false)
  const keyword = ref('')
  const hits = ref<ReaderSearchHit[]>([])
  const searching = ref(false)
  const scannedSections = ref(0)
  const totalSections = ref(0)
  const activeHitId = ref<string | null>(null)
  const reachedResultLimit = ref(false)

  /** 已打上高亮的 CFI，切换命中或换书时需要清理 */
  const highlightedCfis = ref<string[]>([])
  /** 递增令牌：每次输入/换书/关闭面板都会让上一次搜索结果失效 */
  let generation = 0
  let debounceTimer: number | undefined

  const trimmedKeyword = computed(() => keyword.value.trim())
  const hasHighlight = computed(() => highlightedCfis.value.length > 0)
  const hasKeyword = computed(() => trimmedKeyword.value.length > 0)
  const isSearching = computed(() => searching.value)

  const statusText = computed(() => {
    if (!hasKeyword.value) {
      return ''
    }

    if (searching.value) {
      if (totalSections.value > 0) {
        return `正在搜索… ${scannedSections.value}/${totalSections.value} 节`
      }
      return '正在搜索…'
    }

    if (hits.value.length === 0) {
      return '没有找到匹配的内容'
    }

    const suffix = reachedResultLimit.value ? `（已展示前 ${DEFAULT_SEARCH_MAX_RESULTS} 条）` : ''

    return `共 ${hits.value.length} 条结果${suffix}`
  })

  const clearHighlight = () => {
    if (highlightedCfis.value.length === 0) {
      return
    }

    clearSearchHighlights(rendition.value, highlightedCfis.value)
    highlightedCfis.value = []
    activeHitId.value = null
  }

  const resetResultState = () => {
    hits.value = []
    searching.value = false
    scannedSections.value = 0
    totalSections.value = 0
    reachedResultLimit.value = false
    activeHitId.value = null
  }

  /** 换书时调用：旧 rendition 会连同它的 annotations 一起销毁，这里只清状态 */
  const resetForBookChange = () => {
    generation += 1
    window.clearTimeout(debounceTimer)
    highlightedCfis.value = []
    resetResultState()
  }

  const runSearch = async (value: string) => {
    const book = rendition.value?.book
    if (!book) {
      resetResultState()
      return
    }

    const currentGeneration = ++generation
    let cancelled = false
    const isCancelled = () => cancelled || currentGeneration !== generation

    resetResultState()
    searching.value = true

    try {
      const results = await searchBook(book, value, {
        maxResults: DEFAULT_SEARCH_MAX_RESULTS,
        isCancelled,
        onProgress: (scanned, total) => {
          if (currentGeneration !== generation) return
          scannedSections.value = scanned
          totalSections.value = total
        },
        onSectionMatches: (sectionHits) => {
          if (currentGeneration !== generation) return
          hits.value = [...hits.value, ...sectionHits]
        },
      })

      if (currentGeneration !== generation) return
      reachedResultLimit.value = results.length >= DEFAULT_SEARCH_MAX_RESULTS
    } catch (error) {
      logWarn('reader-search', 'search-failed', error)
      if (currentGeneration === generation) {
        resetResultState()
      }
    } finally {
      cancelled = true
      if (currentGeneration === generation) {
        searching.value = false
      }
    }
  }

  const scheduleSearch = () => {
    window.clearTimeout(debounceTimer)
    // 让上一次（可能仍在运行的）搜索立即失效
    generation += 1

    const value = trimmedKeyword.value
    if (!value) {
      resetResultState()
      return
    }

    // 立即进入搜索态，避免结果区在防抖窗口内闪回空态
    searching.value = true
    scannedSections.value = 0
    totalSections.value = 0
    reachedResultLimit.value = false
    hits.value = []

    debounceTimer = window.setTimeout(() => {
      void runSearch(value)
    }, SEARCH_DEBOUNCE_MS)
  }

  watch(trimmedKeyword, () => {
    scheduleSearch()
  })

  watch(rendition, () => {
    resetForBookChange()
  })

  /** 跳转到指定命中位置并高亮匹配的原文 */
  const jumpToHit = async (hit: ReaderSearchHit) => {
    const currentRendition = rendition.value
    if (!currentRendition) {
      return
    }

    activeHitId.value = hit.id
    clearHighlight()
    addSearchHighlight(currentRendition, hit.cfi)
    highlightedCfis.value = [hit.cfi]

    try {
      await currentRendition.display(hit.cfi)
    } catch (error) {
      logWarn('reader-search', 'jump-to-hit-failed', error)
    }
  }

  const openSearch = () => {
    searchVisible.value = true
  }

  const closeSearch = () => {
    searchVisible.value = false
    // 面板关闭后中止仍在进行中的搜索，但保留已有高亮，方便对照原文阅读
    generation += 1
    window.clearTimeout(debounceTimer)
    searching.value = false
  }

  const toggleSearch = () => {
    if (searchVisible.value) {
      closeSearch()
      return
    }
    openSearch()
  }

  const clearKeyword = () => {
    keyword.value = ''
  }

  onScopeDispose(() => {
    window.clearTimeout(debounceTimer)
    generation += 1
  })

  return {
    searchVisible,
    keyword,
    hits,
    isSearching,
    statusText,
    hasHighlight,
    activeHitId,
    jumpToHit,
    openSearch,
    closeSearch,
    toggleSearch,
    clearKeyword,
    clearHighlight,
    resetForBookChange,
  }
}
