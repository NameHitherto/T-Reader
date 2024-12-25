// iframe.js
// epubjs 渲染的iframe子页面，该脚本用于与父页面通信

// 监听点击事件
document.addEventListener('click', (event) => {
    window.parent.postMessage({ type: 'iframe-click' }, '*');
});

// 监听键盘事件
document.addEventListener('keydown', (event) => {
    window.parent.postMessage({ type: 'iframe-keydown', key: event.key }, '*');
});

// 监听右键菜单事件
document.addEventListener('contextmenu', (event) => {
    // 阻止默认右键菜单
    event.preventDefault();
});