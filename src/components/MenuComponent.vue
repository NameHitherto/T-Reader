<template>
    <div class="menu">
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
                <input type="radio" :value="font.name" v-model="selectedFont" />
                <label>{{ font.display }}</label>
            </div>
        </div>
        <div class="basic-section">
            <div class="adjust-option" v-for="(setting, index) in settings" :key="index">
                <label>{{ setting.label }}</label>
                <div class="adjust-button-group">
                    <button class="minus" @click="adjustSetting(setting.key, -1)"></button>
                    <span>{{ setting.value }}</span>
                    <button class="plus" @click="adjustSetting(setting.key, 1)"></button>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';

export default defineComponent({
    setup() {
        const colors = ['#FFFFFF', '#EFE4B0', '#7E7E7E', '#000000'];
        const selectedFont = ref('default');
        const settings = ref([
            { label: '首行缩进', value: 0, key: 'indent' },
            { label: '字体大小', value: 23, key: 'fontSize' },
            { label: '字重', value: 400, key: 'fontWeight' },
            { label: '行距', value: 0, key: 'lineSpacing' },
            { label: '段距', value: 0, key: 'paragraphSpacing' },
            { label: '行首边距', value: 30, key: 'firstLineMargin' },
            { label: '行尾边距', value: 30, key: 'lastLineMargin' },
            { label: '页眉边距', value: 30, key: 'headerMargin' },
            { label: '页脚边距', value: 30, key: 'footerMargin' },
            { label: '最小栏宽', value: 18, key: 'minColumnWidth' },
            { label: '栏间距', value: 3.5, key: 'columnSpacing' },
        ]);

        const fonts = [
            { name: 'default', display: '默认' },
            { name: 'songti', display: '宋体' },
            { name: 'heiti', display: '黑体' },
            { name: 'fangsong', display: '仿宋' },
            { name: 'kaiti', display: '楷体' },
        ];

        const selectColor = (color: string) => {
            console.log('Selected color:', color);
        };

        const adjustSetting = (key: string, amount: number) => {
            const setting = settings.value.find(s => s.key === key);
            if (setting) {
                setting.value += amount;
            }
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
        };
    },
});
</script>

<style scoped>
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
    border-radius: 0px;
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