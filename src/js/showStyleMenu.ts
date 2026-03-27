import MenuComponent from '../components/StyleMenu/index.vue';
import { createApp, h, App as VueApp } from 'vue';

let mountedApp: VueApp<Element> | null = null;
let mountedMenuContainer: HTMLDivElement | null = null;
let outsideClickHandler: ((e: MouseEvent) => void) | null = null;

const setFrontButtonsActive = (active: boolean) => {
    const frontButtons = document.getElementsByClassName('titlebar-front-button');
    for (let i = 0; i < frontButtons.length; i++) {
        if (active) {
            frontButtons[i].classList.add('active');
        } else {
            frontButtons[i].classList.remove('active');
        }
    }
};

const teardownMenu = () => {
    if (outsideClickHandler) {
        document.removeEventListener('click', outsideClickHandler);
        outsideClickHandler = null;
    }

    if (mountedApp) {
        mountedApp.unmount();
        mountedApp = null;
    }

    if (mountedMenuContainer) {
        mountedMenuContainer.remove();
        mountedMenuContainer = null;
    }

    setFrontButtonsActive(false);
};

export const disposeStyleMenu = () => {
    teardownMenu();
};

export default function showStyleMenu() {
    // 获取样式调整按钮
    const customerButton = document.getElementById('titlebar-customer');
    if (!customerButton) {
        console.error('未找到样式调整按钮');
        return;
    }

    // 再次点击按钮时关闭菜单
    if (mountedMenuContainer) {
        teardownMenu();
        return;
    }

    setFrontButtonsActive(true);

    // 创建菜单容器
    const menuContainer = document.createElement('div');
    menuContainer.id = 'customer-menu';
    menuContainer.style.position = 'absolute';
    menuContainer.style.zIndex = '1000';

    // 计算菜单位置
    const buttonRect = customerButton.getBoundingClientRect();
    const menuWidth = 360;
    const offsetLeft = Math.min(buttonRect.left, window.innerWidth - menuWidth - 10);
    menuContainer.style.top = `${buttonRect.bottom + window.scrollY}px`;
    menuContainer.style.left = `${offsetLeft}px`;

    // 将菜单容器插入到文档中
    document.body.appendChild(menuContainer);
    mountedMenuContainer = menuContainer;

    mountedApp = createApp({
        render: () => h(MenuComponent),
    });
    mountedApp.mount(menuContainer);

    outsideClickHandler = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        const isInsideFontDialog = Boolean(
            target?.closest('.system-font-enable-dialog-wrapper') ||
            target?.closest('.system-font-enable-dialog-overlay')
        );

        if (
            isInsideFontDialog ||
            e.target === menuContainer ||
            e.target === customerButton ||
            menuContainer.contains(e.target as Node) ||
            customerButton.contains(e.target as Node)
        ) {
            setFrontButtonsActive(true);
            return;
        }

        teardownMenu();
    };

    document.addEventListener('click', outsideClickHandler);
}

