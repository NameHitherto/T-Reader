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
  displayTarget?: string
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
  cachedLocations?: string,
  initialStylesheetCss = '',
): Promise<EpubRenderResult> => {
  const ePubBook = ePub(bookArrayBuffer)
  await ePubBook.ready
  const stylesheetIsolation = createEpubBuiltInStylesheetIsolationController(ePubBook)
  if (loadEpubBuiltInStylesheet) {
    stylesheetIsolation.enableBuiltInStylesheet()
  } else {
    stylesheetIsolation.disableBuiltInStylesheet()
  }
  stylesheetIsolation.setCustomStylesheet(initialStylesheetCss)

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
      logWarn('epub-render', 'load-locations-cache-failed', error)
    }
  }

  const displayTarget =
    explicitCfi || (await resolveEpubDisplayTarget(ePubBook, progressSnapshot || {}))

  const tocData = await ePubBook.loaded.navigation

  return {
    rendition: rendition as unknown as EpubRenditionLike,
    toc: tocData.toc as EpubTocItem[],
    stylesheetIsolation,
    displayTarget,
  }
}
