import ePub from 'libs/epub.js'
import { BookConfig } from '@/types/book'
import { resolveEpubDisplayTarget } from '@/services/reader/epub/epubProgressService'
import { logWarn } from '@/utils/logger'
import {
  createEpubBuiltInStylesheetIsolationController,
  type EpubBuiltInStylesheetIsolationController,
} from '@/services/reader/epub/epubBuiltinStylesheetIsolationService'
import type { EpubRenditionLike, EpubTocItem } from '@/types/epub'

export interface EpubRenderResult {
  rendition: EpubRenditionLike
  toc: EpubTocItem[]
  stylesheetIsolation: EpubBuiltInStylesheetIsolationController
}

export const destroyEpubRendition = (rendition: EpubRenditionLike | null) => {
  if (!rendition) {
    return
  }

  if (rendition.hooks && rendition.hooks.content) {
    rendition.hooks.content.clear?.()
  }

  rendition.destroy()
}

export const renderEpubBook = async (
  bookArrayBuffer: ArrayBuffer,
  flow: string,
  loadEpubBuiltInStylesheet: boolean,
  explicitCfi?: string,
  progressSnapshot?: Partial<BookConfig>,
  cachedLocations?: string
): Promise<EpubRenderResult> => {
  const ePubBook = ePub(bookArrayBuffer)
  await ePubBook.ready
  const stylesheetIsolation = createEpubBuiltInStylesheetIsolationController(ePubBook)
  if (loadEpubBuiltInStylesheet) {
    stylesheetIsolation.enableBuiltInStylesheet()
  } else {
    stylesheetIsolation.disableBuiltInStylesheet()
  }

  const epubReader = document.getElementById('epub-reader')
  if (epubReader) {
    epubReader.innerHTML = ''
  }

  const rendition = ePubBook.renderTo('epub-reader', {
    width: '100%',
    height: '100%',
    manager: 'continuous',
    flow,
    spread: 'true',
    allowScriptedContent: true,
  })

  if (cachedLocations) {
    try {
      ePubBook.locations.load(cachedLocations)
    } catch (error) {
      logWarn('epubAdapter', '加载 EPUB locations 缓存失败', error)
    }
  } else {
    void ePubBook.locations.generate(1000).catch((error: unknown) => {
      logWarn('epubAdapter', '生成 EPUB locations 失败', error)
    })
  }

  const displayTarget =
    explicitCfi || (await resolveEpubDisplayTarget(ePubBook, progressSnapshot || {}))
  if (displayTarget) {
    await rendition.display(displayTarget)
  } else {
    await rendition.display()
  }

  const tocData = await ePubBook.loaded.navigation

  return {
    rendition: rendition as unknown as EpubRenditionLike,
    toc: tocData.toc as EpubTocItem[],
    stylesheetIsolation,
  }
}
