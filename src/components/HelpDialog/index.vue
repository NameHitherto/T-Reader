<template>
  <el-dialog
    align-center
    class="help-dialog-wrapper"
    :append-to-body="true"
    :show-close="false"
    :close-on-press-escape="false"
  >
    <div class="help-dialog-view">
      <el-scrollbar max-height="60vh">
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

        <div class="help-enabled-fonts section">
          <div class="title">已启用的系统字体</div>
          <div class="font-panel">
            <div class="font-panel-head">
              <div class="font-panel-copy">
                <div class="font-panel-subtitle">当前可在样式菜单中选择的系统字体</div>
                <div class="font-panel-description">
                  没有启用时，阅读器只会使用系统默认 PingFang。
                </div>
              </div>
              <el-button class="font-panel-button" @click="fontDialogVisible = true">
                自定义系统字体
              </el-button>
            </div>

            <div v-if="enabledSystemFonts.length > 0" class="font-card-list">
              <div
                v-for="font in enabledSystemFonts"
                :key="getSystemFontEntryKey(font)"
                class="font-card"
              >
                <div class="font-card-name">{{ font.family }}</div>
                <div class="font-card-meta">
                  {{ font.style || 'Regular' }}
                  <template v-if="font.weight"> / {{ font.weight }}</template>
                </div>
              </div>
            </div>

            <div v-else class="font-empty-state">
              当前仅启用系统默认 PingFang，尚未选择额外系统字体。
            </div>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <SystemFontEnableDialog v-model="fontDialogVisible" />
  </el-dialog>
</template>

<script lang="ts">
import { computed, defineComponent, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useReaderConfigStore } from '@/store/readerConfigStore'
import SystemFontEnableDialog from '@/components/SystemFontEnableDialog/index.vue'
import { getSystemFontEntryKey } from '@/services/reader/systemFontService'
import styleDemoImg from '@/assets/images/style_demo.png'

export default defineComponent({
  name: 'HelpDialog',
  components: {
    SystemFontEnableDialog,
  },
  setup() {
    const readerConfigStore = useReaderConfigStore()
    const { readerConfig } = storeToRefs(readerConfigStore)
    const fontDialogVisible = ref(false)
    const shortcuts = [
      { description: '上一页', key: ['↑'] },
      { description: '上一页', key: ['←'] },
      { description: '下一页', key: ['↓'] },
      { description: '下一页', key: ['→'] },
      { description: '沉浸阅读', key: ['F11'] },
      { description: '测试', key: ['Ctrl', 'Alt', 'T'] },
    ]

    const groupedShortcuts = computed(() => {
      const map = new Map<string, string[][]>()
      shortcuts.forEach((shortcut) => {
        if (!map.has(shortcut.description)) {
          map.set(shortcut.description, [])
        }
        map.get(shortcut.description)?.push(shortcut.key)
      })

      return Array.from(map.entries()).map(([description, variants]) => ({
        description,
        variants,
      }))
    })

    return {
      groupedShortcuts,
      styleDemoImg,
      fontDialogVisible,
      enabledSystemFonts: computed(() => readerConfig.value.enabledSystemFonts),
      getSystemFontEntryKey,
    }
  },
})
</script>

<style lang="scss" scoped>
@font-face {
  font-family: 'Jetbrains';
  src: url('/src/font/JetBrainsMono.ttf') format('truetype');
}

.help-dialog-wrapper {
  max-width: 560px;

  .help-dialog-view {
    width: 100%;
    display: flex;
    flex-direction: column;

    :deep(.el-scrollbar__view) {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .section {
      width: 100%;

      .title {
        font-weight: 700;
        font-size: 24px;
        margin: 0 0 10px 4px;
        color: #0f172a;
      }

      .content-box {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        padding: 10px;
        border: 1px solid #edf0f4;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
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
        border: 1px solid #edf0f4;
        border-radius: 18px;
        background: #ffffff;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
      }

      .row {
        display: flex;
        align-items: flex-start;
        line-height: 1.4;
        padding: 16px 20px;
      }

      .header {
        font-weight: 700;
        background: #f8fafc;
        border-top-left-radius: 18px;
        border-top-right-radius: 18px;
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
          border-radius: 12px;
        }
      }
    }

    .help-enabled-fonts {
      .font-panel {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 16px;
        border-radius: 18px;
        border: 1px solid #edf0f4;
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
      }

      .font-panel-head {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
      }

      .font-panel-subtitle {
        font-size: 15px;
        font-weight: 700;
        color: #1f2937;
      }

      .font-panel-description {
        margin-top: 6px;
        font-size: 13px;
        line-height: 1.7;
        color: #64748b;
      }

      :deep(.font-panel-button.el-button) {
        flex-shrink: 0;
        height: 40px;
        padding: 0 16px;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.28);
        background: #ffffff;
        color: #334155;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
        transition:
          transform 0.18s ease,
          box-shadow 0.18s ease,
          border-color 0.18s ease,
          color 0.18s ease;

        &:hover {
          transform: translateY(-1px);
          border-color: rgba(59, 130, 246, 0.2);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
          color: #1d4ed8;
        }
      }

      .font-card-list {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .font-card {
        min-width: 150px;
        padding: 14px 16px;
        border-radius: 16px;
        background: #ffffff;
        border: 1px solid rgba(226, 232, 240, 0.92);
        box-shadow: 0 6px 16px rgba(15, 23, 42, 0.05);
      }

      .font-card-name {
        font-size: 15px;
        font-weight: 700;
        color: #1f2937;
      }

      .font-card-meta {
        margin-top: 6px;
        font-size: 12px;
        color: #64748b;
      }

      .font-empty-state {
        padding: 18px;
        border-radius: 16px;
        background: rgba(148, 163, 184, 0.08);
        color: #64748b;
        font-size: 13px;
        line-height: 1.7;
      }
    }
  }
}

@media (max-width: 720px) {
  .help-dialog-wrapper {
    .help-dialog-view {
      .help-enabled-fonts {
        .font-panel-head {
          flex-direction: column;
        }
      }
    }
  }
}
</style>
