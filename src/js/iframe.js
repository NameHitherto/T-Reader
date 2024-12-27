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
          text,
          range: serializeRange(range),
          mousePos,
        },
        '*'
      )
    } else {
      window.parent.postMessage({ type: 'iframe-contextmenu-casual' }, '*')
    }
  } else {
    window.parent.postMessage({ type: 'iframe-contextmenu-casual' }, '*')
  }
})

// 监听通信事件
window.addEventListener('message', (event) => {
  // 添加书签事件
  if (event.data.type === 'to-iframe-bookmark') {
    // 创建书签标记元素
    const marker = document.createElement('span')
    marker.className = 'text-marker'
    marker.style.backgroundColor = '#a6e3e9'
    marker.style.color = '#000'
    marker.style.fontWeight = 'bold'
    marker.style.position = 'relative'
    // 添加标签图标icon
    const icon = document.createElement('span')
    icon.textContent = '🔖'
    icon.style.position = 'absolute'
    icon.style.fontSize = '12px'
    icon.style.top = '-10px'
    icon.style.left = '-10px'
    // 将icon添加到标记中
    marker.appendChild(icon)
    // 将标记元素包裹选中的文本
    try {
      const range = deserializeRange(
        JSON.parse(event.data.range._value),
        document
      )
      const selectedContents = range.extractContents()
      marker.appendChild(selectedContents)
      range.insertNode(marker)
    } catch (e) {
      console.error(e)
    }
  }
})

// 序列化Range对象
function serializeRange(range) {
  const startContainerPath = getNodePath(range.startContainer)
  const endContainerPath = getNodePath(range.endContainer)

  return {
    startContainerPath, // 起始节点路径
    startOffset: range.startOffset, // 起始偏移量
    endContainerPath, // 结束节点路径
    endOffset: range.endOffset, // 结束偏移量
  }
}

// 反序列化 Range 对象
function deserializeRange(serializedRange, iframeDocument) {
  const startContainer = getNodeFromPath(
    serializedRange.startContainerPath,
    iframeDocument
  )
  const endContainer = getNodeFromPath(
    serializedRange.endContainerPath,
    iframeDocument
  )

  const range = iframeDocument.createRange()
  range.setStart(startContainer, serializedRange.startOffset)
  range.setEnd(endContainer, serializedRange.endOffset)
  return range
}

// 获取节点的路径(以索引标识)
function getNodePath(node) {
  const path = []
  while (node && node.parentNode) {
    const index = Array.prototype.indexOf.call(node.parentNode.childNodes, node)
    path.unshift(index)
    node = node.parentNode
  }
  return path
}

// 从路径反序列化节点
function getNodeFromPath(path, rootNode) {
  let node = rootNode
  path.forEach((index) => {
    node = node.childNodes[index]
  })
  return node
}
