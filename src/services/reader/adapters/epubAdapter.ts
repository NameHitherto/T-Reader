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

/**
 * 渲染 EPUB。
 * 首屏显示完成后立即返回，章节定位和目录可后台继续准备，避免加载弹层长时间不关闭。
 */
export const renderEpubBook = async (
  bookArrayBuffer: ArrayBuffer,
  flow: string,
  location?: string
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

  if (location) {
    await rendition.display(location)
  } else {
    await rendition.display()
  }

  const tocData = await ePubBook.loaded.navigation

  // 位置索引生成比较耗时，改为后台执行，不阻塞首屏渲染。
  void ePubBook.locations.generate(1000).catch((error: unknown) => {
    console.warn('生成 EPUB 位置索引失败:', error)
  })

  return {
    rendition,
    toc: tocData.toc,
  }
}
