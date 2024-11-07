<template>
    <div class="menu fade-in">
        <div class="color-section section">
            <span class="section-title">背景</span>
            <div id="color-box-selector">
                <span v-for="color in colors" :key="color" :style="{ backgroundColor: color }" class="color-box"
                    @click="selectColor(color)">
                </span>
            </div>
        </div>
        <div class="font-section section">
            <span class="section-title">字体</span>
            <div v-for="font in fonts" :key="font.name" class="font-option">
                <input type="radio" :value="font.name" v-model="selectedFont" @click="selectFont(font.name)"/>
                <label>{{ font.display }}</label>
            </div>
        </div>
        <div class="basic-section section">
            <div class="adjust-option" v-for="(setting, index) in settings" :key="index">
                <label>{{ setting.label }}</label>
                <div class="adjust-button-group">
                    <button class="minus" @click="adjustSetting(setting.key, setting.amount * -1)"></button>
                    <span>{{ setting.value }}</span>
                    <button class="plus" @click="adjustSetting(setting.key, setting.amount)"></button>
                </div>
            </div>
        </div>
        <div id="reset-button" @click="resetStyle">
            <span class="circle" aria-hidden="true">
                <span class="icon arrow"></span>
            </span>
            <span class="button-text">恢复默认样式</span>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import { useReaderConfigStore } from '../store/readerConfigStore';
import { storeToRefs } from 'pinia';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { confirm } from '@tauri-apps/plugin-dialog';
import '../css/ResetButton.css';

export default defineComponent({
    setup() {
        // 正式全局变量
        const readerConfigStore = useReaderConfigStore();
        // 全局状态变量，但只能访问不能修改
        const { readerConfig } = storeToRefs(readerConfigStore);

        const colors = ['#FFFFFF', '#faebd7', '#000000'];
        const selectedFont = ref(readerConfig.value.font); 
        const settings = ref([
            { label: '首行缩进', value: readerConfig.value.indent, key: 'indent', amount: 1 },
            { label: '字体大小', value: readerConfig.value.fontSize, key: 'fontSize', amount: 1 },
            { label: '字重', value: readerConfig.value.fontWeight, key: 'fontWeight', amount: 100 },
            { label: '行距', value: readerConfig.value.lineSpacing, key: 'lineSpacing', amount: 0.1 },
            { label: '段距', value: readerConfig.value.paragraphSpacing, key: 'paragraphSpacing', amount: 0.1 },
            { label: '行首边距', value: readerConfig.value.firstLineMargin, key: 'firstLineMargin',amount: 1 },
            { label: '行尾边距', value: readerConfig.value.lastLineMargin, key: 'lastLineMargin', amount: 1 },
            { label: '页眉边距', value: readerConfig.value.headerMargin, key: 'headerMargin', amount: 1 },
            { label: '页脚边距', value: readerConfig.value.footerMargin, key: 'footerMargin', amount: 1 },
            { label: '最小栏宽', value: readerConfig.value.minColumnWidth, key: 'minColumnWidth', amount: 1 },
            { label: '栏间距', value: readerConfig.value.columnSpacing, key: 'columnSpacing', amount: 1 },
        ]);

        const fonts = [
            { name: 'system-ui', display: '默认' },
            { name: 'cursive', display: 'cursive' },
            { name: 'fangsong', display: '仿宋' },
            { name: 'monospace', display: 'monospace' },
            { name: 'serif', display: 'serif' },
        ];

        // 样式视觉化更新
        const updateVisual = () => {
            settings.value = settings.value.map(setting => {
                setting.value = readerConfig.value[setting.key];
                return setting;
            });
            selectedFont.value = readerConfig.value.font;
        }

        // 通知阅读器更新样式
        const emitStyleApplication = () => {
            getCurrentWebviewWindow().emitTo('reader', 'update-reader-style');
        };

        // 样式恢复默认
        const resetStyle = async() => {
            const confirmation = await confirm(
                '确定要恢复默认样式吗？',
                {title: '恢复默认样式', kind: 'warning'}
            );
            if(confirmation){
                // 重置状态变量
                readerConfigStore.setDefaultConfig();
                // 阅读器样式更新
                emitStyleApplication();
                // 更新可视化
                updateVisual();
            }
        }

        // 选择背景颜色
        const selectColor = (color: string) => {
            if(color === '#000000'){
                readerConfigStore.changeState('fontColor', '#FFFFFF');
                readerConfigStore.changeState('color', color);
            }else{
                readerConfigStore.changeState('fontColor', '#000000');
                readerConfigStore.changeState('color', color);
            }
            emitStyleApplication();
        };

        // 选择字体
        const selectFont = (font: string) => {
            readerConfigStore.changeState('font', font);
            emitStyleApplication();
            updateVisual();
        };

        // 调整样式设置
        const adjustSetting = (key: string, amount: number) => {
            // 更新状态全局变量
            readerConfigStore.calculate(key, amount);
            // 通知阅读器更新样式
            emitStyleApplication();
            // 更新可视化
            settings.value = settings.value.map(setting => {
                if (setting.key === key) {
                    setting.value = readerConfig.value[key];
                }
                return setting;
            });
        };

        onMounted(() => {
            const menuElement = document.querySelector('.menu') as HTMLElement;
            if (menuElement) {
                const windowHeight = window.innerHeight;
                const menuHeight = menuElement.offsetHeight;
                menuElement.style.height = `${Math.min(windowHeight - 100, menuHeight)}px`;
            }
        })

        return {
            colors,
            selectedFont,
            settings,
            fonts,
            selectColor,
            adjustSetting,
            resetStyle,
            selectFont,
        };
    },
});
</script>

<style scoped>
/* 组件浮现动画 */ 
@keyframes fadeIn{
    0% {
        opacity: 0;
        transform: translateY(-100px) scale(0.8);
    }
    100%{
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.fade-in{
    animation: fadeIn 0.15s ease-in-out;
}

label{
    font-size: 14px;
}
.menu {
    background-color: white;
    padding: 10px;
    width: 200px;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    overflow: auto;
}

.menu::-webkit-scrollbar {
    width: 6px;
}

.menu::-webkit-scrollbar-track {
    background: transparent;
}

.menu::-webkit-scrollbar-thumb {
    background-color: rgb(216, 216, 216);
    /* 浅色背景 */
    border-radius: 6px;
    background-clip: content-box;
}

.section {
    padding-bottom: 10px;
    border-bottom: 1px solid #ebebeb;
}

.section-title{
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 5px;
}

.color-section {
    display: flex;
    flex-direction: column;
}

#color-box-selector{
    display: flex;
}

.color-box {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid #ccc;
    margin-right: 8px;
    cursor: pointer;
    transition: border 0.3s;
}

.color-box:hover {
    border-color: #999;
}

.font-section {
    margin-top: 5px;
}

.font-option {
    display: flex;
    align-items: center;
}

.adjust-option {
    display: flex;
    align-items: center;
    margin-top: 10px;
    justify-content: space-between;
}

.adjust-button-group {
    display: flex;
    gap: 10px;
}

.adjust-option label {
    margin-right: 10px;
}

button {
    width: 20px;
    height: 20px;
    cursor: pointer;
    padding: 0 5px;
    border: none;
    background-color: transparent;
    border-radius: 50%;
    transition: background-color 0.3s;
    background-position: center;
    background-repeat: no-repeat;
}

button:hover {
    background-color: #c0c0c0;
    border-radius: 50%;
}

.minus{
    background-image: url('../assets/minus.svg');
}

.plus{
    background-image: url('../assets/plus.svg');
}
</style>