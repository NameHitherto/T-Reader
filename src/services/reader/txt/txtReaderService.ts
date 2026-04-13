export const parseTxtLocation = (location?: string | null): number => {
  if (!location) {
    return 0
  }
  const parsed = Number.parseInt(location, 10)
  if (Number.isNaN(parsed)) {
    return 0
  }
  return Math.max(0, parsed)
}

export const calcTxtProgress = (
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number
): number => {
  const maxScroll = Math.max(1, scrollHeight - clientHeight)
  return Number(((scrollTop / maxScroll) * 100).toFixed(2))
}

export const findParagraphIndexByScroll = (
  paragraphs: HTMLElement[],
  scrollTop: number
): number => {
  const current = paragraphs.find((node) => node.offsetTop >= scrollTop)
  if (!current?.dataset.idx) {
    return 0
  }

  const idx = Number.parseInt(current.dataset.idx, 10)
  return Number.isNaN(idx) ? 0 : idx
}
