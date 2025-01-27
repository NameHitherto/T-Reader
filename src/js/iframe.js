// iframe.js
// epubjs 渲染的iframe子页面，该脚本用于与父页面通信

// 监听点击事件
document.addEventListener('click', (event) => {
  window.parent.postMessage({ type: 'iframe-click' }, '*')
})

// 监听键盘事件
document.addEventListener('keydown', (event) => {
  window.parent.postMessage({ type: 'iframe-keydown', key: event.key }, '*')
})

// 监听右键菜单事件
document.addEventListener('contextmenu', (event) => {
  // 阻止默认右键菜单
  event.preventDefault()

  const mousePos = { x: event.clientX, y: event.clientY }

  // 获取选中的文本
  const selection = window.getSelection()
  const text = selection.toString()

  // 检查鼠标位置是否在选中区域内
  if (text) {
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    if (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    ) {
      window.parent.postMessage(
        {
          type: 'iframe-contextmenu',
          mousePos,
        },
        '*'
      )
    } else {
      window.parent.postMessage({ type: 'iframe-contextmenu-casual', mousePos }, '*')
    }
  } else {
    window.parent.postMessage({ type: 'iframe-contextmenu-casual', mousePos }, '*')
  }
})
