import ePub, { Rendition } from 'libs/epub.js'

export interface EpubRenderResult {
  rendition: Rendition
  toc: any[]
}

export const destroyEpubRendition = (rendition: any) => {
  if (!rendition) {
    return
  }

  if (rendition.hooks && rendition.hooks.content) {
    rendition.hooks.content.clear()
  }

  rendition.destroy()
}

export const renderEpubBook = async (
  bookArrayBuffer: ArrayBuffer,
  flow: string,
  location?: string,
  cachedLocations?: string
): Promise<EpubRenderResult> => {
  const ePubBook = ePub(bookArrayBuffer)
  await ePubBook.ready

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
      console.warn('加载 EPUB locations 缓存失败:', error)
    }
  } else {
    void ePubBook.locations.generate(1000).catch((error: unknown) => {
      console.warn('生成 EPUB locations 失败:', error)
    })
  }

  if (location) {
    await rendition.display(location)
  } else {
    await rendition.display()
  }

  const tocData = await ePubBook.loaded.navigation

  return {
    rendition,
    toc: tocData.toc,
  }
}
