// src/stores/readerConfigStore.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useReaderConfigStore = defineStore('readerConfig', () => {
    // 使用 ref 定义响应式状态
    const readerConfig = ref<any>({
        // 字体大小
        fontSize: 16,
        // 字重
        fontWeight: 400,
        // 行距
        lineSpacing: 1.3,
        // 段间距
        paragraphSpacing: 0.2,
        // 行首边距
        firstLineMargin: 36,
        // 行尾边距
        lastLineMargin: 36,
        // 页眉边距
        headerMargin: 20,
        // 页脚边距
        footerMargin: 20,
        // 最小栏宽
        minColumnWidth: 23,
        // 栏间距
        columnSpacing: 72,
        // 首行缩进
        indent: 2,
        // 字体
        font: 'Arial',
        // 背景颜色
        color: '#FFFFFF',
        // 字体颜色
        fontColor: '#000000',
        // 翻页模式
        flow: 'paginated'
    });

    // 此处可以定义一个恢复默认设置的方法
    const setDefaultConfig = () => {
        readerConfig.value = {
            fontSize: 16, // 字体大小默认16px
            fontWeight: 400, // 字重默认400
            lineSpacing: 1.3, // 行距默认1.3em
            paragraphSpacing: 0.2, // 段间距默认0.2em
            firstLineMargin: 36, // 行首边距默认36px
            lastLineMargin: 36, // 行尾边距默认36px
            headerMargin: 20, // 页眉边距默认20px
            footerMargin: 20, // 页脚边距默认20px
            minColumnWidth: 23, // 最小栏宽默认23em
            columnSpacing: 72, // 栏间距默认72px
            indent: 2, // 首行缩进默认2em
            font: 'system-ui', // 默认字体
            color: '#FFFFFF', // 默认白色
            fontColor: '#000000', // 默认黑色
            flow: 'paginated' // 默认翻页模式
    }};

    // 更新状态变量
    const setReaderConfig = (config: any) => {
        readerConfig.value = { ...readerConfig.value, ...config };
    };

    // 定义计算方法
    const calculate = (key: string, value: number) => {
        readerConfig.value[key] += value;
        // 保留小数位同number一样
        readerConfig.value[key] = Number(readerConfig.value[key].toFixed(2));
    };

    // 定义Action
    const changeState = (key: string, value: any) => {
        readerConfig.value[key] = value;
    }

    return {
        readerConfig,
        setReaderConfig,
        calculate,
        changeState,
        setDefaultConfig,
    };
});
