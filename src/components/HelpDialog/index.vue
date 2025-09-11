<template>
    <el-dialog
        align-center
        class="help-dialog-wrapper"
        :append-to-body="true"
        :show-close="false"
        :close-on-press-escape="false"
    >
        <div class="help-dialog-view">
            <el-scrollbar max-height="50vh">
                <div class="help-function-shortcuts section">
                    <div class="title">快捷方式</div>
                    <div class="shortcuts-table">
                        <div class="row header">
                            <div class="col col-desc">功能</div>
                            <div class="col col-keys">快捷键</div>
                        </div>
                        <div class="row" v-for="item in groupedShortcuts" :key="item.description">
                            <div class="col col-desc">{{ item.description }}</div>
                            <div class="col col-keys">
                                <template v-for="(variant, vi) in item.variants" :key="vi">
                                    <template v-if="vi > 0"> / </template>
                                    <span class="key-seq">
                                        <template v-for="(k, ki) in variant" :key="k + ki">
                                            <span class="code-style key">{{ k }}</span>
                                            <span v-if="ki < variant.length - 1" class="joiner">+</span>
                                        </template>
                                    </span>
                                </template>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="help-style-demo section">
                    <div class="title">样式设置演示</div>
                    <div class="style-demo-img content-box">
                        <img :src="styleDemoImg" alt="样式设置演示" />
                    </div>
                </div>
                <div class="help-font-exclusion section">
                    <div class="title">字体排除项</div>
                    <div class="content-box">
                        <span class="code-style exclusion-key" v-for="value in fontExclusion" :key="value">{{ value }}</span>
                    </div>
                </div>
            </el-scrollbar>
        </div>
    </el-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import { fontExclusion } from '@/constant/fontExclusion';
import styleDemoImg from '@/assets/images/style_demo.png';

export default defineComponent({
    name: 'HelpDialog',
    props: {},
    data() {
        return {
            shortcuts: [
                { description: '上一页', key: ['↑'] },
                { description: '上一页', key: ['←'] },
                { description: '下一页', key: ['↓'] },
                { description: '下一页', key: ['→'] },
                { description: '沉浸阅读', key: ['F11'] },
                { description: '测试', key: ['Ctrl', 'Alt', 'T'] }
            ],
            fontExclusion,
            styleDemoImg
        }
    },
    computed: {
        groupedShortcuts(): { description: string; variants: string[][] }[] {
            const map = new Map<string, string[][]>();
            this.shortcuts.forEach(s => {
                if (!map.has(s.description)) map.set(s.description, []);
                map.get(s.description)!.push(s.key);
            });
            return Array.from(map.entries()).map(([description, variants]) => ({ description, variants }));
        }
    }
});
</script>
<style lang="scss" scoped>
@font-face {
    font-family: 'Jetbrains';
    src: url('/src/font/JetBrainsMono.ttf') format('truetype');
}

.help-dialog-wrapper {
    max-width: 420px;

    .help-dialog-view {
        width: 100%;
        display: flex;
        flex-direction: column;

        :deep(.el-scrollbar__view) {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .section {
            width: 100%;

            .title {
                font-weight: bold;
                font-size: 24px;
                margin: 0 0 6px 12px;
            }
            .content-box {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                padding: 5px;
                border: 1px solid var(--t-color-code-block-grey);
                border-radius: 12px;
            }
            .code-style {
                font-family: 'Jetbrains';
                background: var(--t-color-code-block-grey);
                padding: 4px 8px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                line-height: 1.2;
                color: #6c6c6c;
            }
        }

        .help-function-shortcuts {
            .shortcuts-table {
                display: flex;
                position: relative;
                flex-direction: column;
                gap: 6px;
                font-size: 18px;
                border: 1px solid var(--t-color-code-block-grey);
                border-radius: 12px;
            }
            .row {
                display: flex;
                align-items: flex-start;
                line-height: 1.4;
                padding: 16px 20px;
            }
            .header {
                font-weight: 600;
                background: var(--t-color-code-block-grey);
                border-top-left-radius: 12px;
                border-top-right-radius: 12px;
            }
            .col {
                width: 50%;
                word-break: keep-all;
            }
            .col-keys {
                flex: 1;
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                color: var(--el-text-color-regular, #606266);
            }
            .key-seq {
                display: inline-flex;
                align-items: center;
                margin-right: 2px;
            }
            .key {
                display: inline-block;
            }
            .joiner {
                margin: 0 8px;
                color: #999;
                font-weight: 500;
            }
        }

        .help-style-demo {
            .style-demo-img {
                display: flex;
                justify-content: center;
                align-items: center;

                img {
                    width: 100%;
                }
            }
        }
    }
}
</style>