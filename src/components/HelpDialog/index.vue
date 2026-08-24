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
            <div v-for="item in groupedShortcuts" :key="item.description" class="row">
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
                <div class="font-panel-description">没有启用时，阅读器只会使用系统默认 Serif。</div>
              </div>
              <el-button class="font-panel-button" @click="$emit('open-system-font-dialog')">
                自定义系统字体
              </el-button>
            </div>

            <div v-if="enabledSystemFonts.length > 0" class="font-card-list">
              <div
                v-for="font in enabledSystemFonts"
                :key="getSystemFontEntryKey(font)"
                class="font-card"
              >
                <div class="font-card-name">{{ font.displayFamily }}</div>
                <div class="font-card-meta">
                  {{ font.fullName || font.subfamily || 'Regular' }}
                  <template v-if="!font.fullName && font.weight"> / {{ font.weight }}</template>
                </div>
              </div>
            </div>

            <div v-else class="font-empty-state">
              当前仅启用系统默认 Serif，尚未选择额外系统字体。
            </div>
          </div>
        </div>
      </el-scrollbar>
    </div>
  </el-dialog>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { useReaderConfig } from '@/services/reader/config'
import { getSystemFontEntryKey } from '@/services/reader/systemFonts'
import styleDemoImg from '@/assets/images/style_demo.png'

export default defineComponent({
  name: 'HelpDialog',
  emits: ['open-system-font-dialog'],
  setup() {
    const readerConfigStore = useReaderConfig()
    const { readerConfig } = readerConfigStore
    const shortcuts = [
      { description: '上一页', key: ['↑'] },
      { description: '上一页', key: ['←'] },
      { description: '下一页', key: ['↓'] },
      { description: '下一页', key: ['→'] },
      { description: '沉浸阅读', key: ['F11'] },
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
      enabledSystemFonts: computed(() => readerConfig.value.enabledSystemFonts),
      getSystemFontEntryKey,
    }
  },
})
</script>

<style lang="scss" scoped>
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
        color: var(--text-primary);
      }

      .content-box {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        padding: 10px;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        background: var(--surface-card);
        box-shadow: var(--shadow-sm);
      }

      .code-style {
        font-family: var(--font-family-mono);
        background: var(--surface-code-inline);
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.2;
        color: var(--text-secondary);
      }
    }

    .help-function-shortcuts {
      .shortcuts-table {
        display: flex;
        position: relative;
        flex-direction: column;
        gap: 6px;
        font-size: 18px;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        background: var(--surface-strong);
        box-shadow: var(--shadow-md);
      }

      .row {
        display: flex;
        align-items: flex-start;
        line-height: 1.4;
        padding: 16px 20px;
      }

      .header {
        font-weight: 700;
        background: var(--surface-card-soft);
        border-top-left-radius: var(--radius-lg);
        border-top-right-radius: var(--radius-lg);
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
        color: var(--text-secondary);
      }

      .key-seq {
        display: inline-flex;
        align-items: center;
        margin-right: 2px;
      }

      .joiner {
        margin: 0 8px;
        color: var(--text-muted);
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
          border-radius: var(--radius-sm);
        }
      }
    }

    .help-enabled-fonts {
      .font-panel {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 16px;
        border-radius: var(--radius-lg);
        border: 1px solid var(--border-default);
        background: var(--surface-card);
        box-shadow: var(--shadow-md);
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
        color: var(--text-primary);
      }

      .font-panel-description {
        margin-top: 6px;
        font-size: 13px;
        line-height: 1.7;
        color: var(--text-tertiary);
      }

      :deep(.font-panel-button.el-button) {
        flex-shrink: 0;
        min-width: 140px;
      }

      .font-card-list {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .font-card {
        min-width: 150px;
        padding: 14px 16px;
        border-radius: var(--radius-md);
        background: var(--surface-strong);
        border: 1px solid var(--border-default);
        box-shadow: var(--shadow-sm);
      }

      .font-card-name {
        font-size: 15px;
        font-weight: 700;
        color: var(--text-primary);
      }

      .font-card-meta {
        margin-top: 6px;
        font-size: 12px;
        color: var(--text-tertiary);
      }

      .font-empty-state {
        padding: 18px;
        border-radius: var(--radius-md);
        background: var(--surface-card-soft);
        color: var(--text-tertiary);
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
