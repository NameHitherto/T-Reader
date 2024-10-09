import MenuComponent from '../components/MenuComponent.vue';
import { createApp, h } from 'vue';
export default function showStyleMenu() {
    // 给所有类名为titlebar-front-button的元素添加active类
    const frontButtons = document.getElementsByClassName('titlebar-front-button');
    for (let i = 0; i < frontButtons.length; i++) {
        frontButtons[i].classList.add('active');
    }

    // 点击除了菜单容器本身以外的地方时关闭菜单
    const clickHandler = (e: MouseEvent) => {
        if (e.target === menuContainer || e.target === customerButton || menuContainer.contains(e.target as Node) || customerButton?.contains(e.target as Node)) {
            for (let i = 0; i < frontButtons.length; i++) {
                frontButtons[i].classList.add('active');
            }
            return;
        };

        // 当容器已被挂载时才会进行移除
        if (menuContainer.children.length > 0) {
            menuContainer.remove();
            // 移除监听点击事件
            document.removeEventListener('click', clickHandler);
            // 移除active类
            for (let i = 0; i < frontButtons.length; i++) {
                frontButtons[i].classList.remove('active');
            }
        }
    };

    // 获取样式调整按钮
    const customerButton = document.getElementById('titlebar-customer');
    if (!customerButton){
        console.error('未找到样式调整按钮');
        return;
    }

    // 检查是否已经存在菜单，如果存在则移除
    let existingMenu = document.getElementById('customer-menu');
    if (existingMenu) {
      existingMenu.remove();
      // 移除active类
      for (let i = 0; i < frontButtons.length; i++) {
        frontButtons[i].classList.remove('active');
      }
      // 此时移除原有的监听点击事件
      document.removeEventListener('click', clickHandler);
      return;
    }

    // 创建菜单容器
    const menuContainer = document.createElement('div');
    menuContainer.id = 'customer-menu';
    menuContainer.style.position = 'absolute';
    menuContainer.style.zIndex = '1000';

    // 计算菜单位置
    const buttonRect = customerButton.getBoundingClientRect();
    const menuWidth = 300; // MenuComponent 的宽度
    const offsetLeft = Math.min(buttonRect.left, window.innerWidth - menuWidth - 10);
    menuContainer.style.top = `${buttonRect.bottom + window.scrollY}px`;
    menuContainer.style.left = `${offsetLeft}px`;

    // 将菜单容器插入到文档中
    document.body.appendChild(menuContainer);

    // 创建并挂载 MenuComponent
    createApp({
      render: () => h(MenuComponent)
    }).mount(menuContainer);

    // 此时移除可能有的监听点击事件
    document.removeEventListener('click', clickHandler);

    // 监听点击事件
    document.addEventListener('click', clickHandler);
}

