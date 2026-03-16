export const scrollTxtByPage = (
  txtReader: HTMLElement | null,
  direction: 'prev' | 'next',
  ratio = 0.85
) => {
  if (!txtReader) {
    return
  }

  const offset = txtReader.clientHeight * ratio
  txtReader.scrollBy({
    top: direction === 'prev' ? -offset : offset,
    behavior: 'smooth',
  })
}
