<template>
  <div
    ref="menuElement"
    class="menu"
    :style="menuStyle"
  >
    <div class="menu-hero">
      <div class="menu-title">阅读样式</div>
      <div class="menu-theme">
        <span class="summary-pill">当前主题 · {{ themeModeLabel }}</span>
      </div>
    </div>

    <div class="font-section section">
      <div class="section-head">
        <span class="section-title">字体</span>
        <div class="font-summary">
          <span class="summary-pill">已启用 {{ enabledFontCount }} 款系统字体</span>
        </div>
      </div>

      <div class="font-option">
        <el-select
          v-model="selectedFont"
          placeholder="系统默认字体"
          class="font-select"
          popper-class="style-menu-select-popper"
          @change="selectFont"
        >
          <el-option
            v-for="font in fontOptions"
            :key="font.value"
            :label="font.label"
            :value="font.value"
          />
        </el-select>
      </div>

      <button class="font-manage-button app-secondary-button" @click="openFontDialog">
        选择系统字体
      </button>
    </div>

    <div class="basic-section section">
      <div
        class="adjust-option"
        v-for="(setting, index) in settings"
        :key="index"
      >
        <label>{{ setting.label }}</label>
        <el-input-number
          v-model="setting.value"
          class="input-number"
          :min="setting.min"
          :max="setting.max"
          :precision="setting.precision"
          :step="setting.amount"
          size="small"
          @change="adjustSetting(setting.key, setting.value)"
        />
      </div>
    </div>

    <div class="extra-section section">
      <span class="section-title">其他</span>
      <div class="flow-option">
        <label>翻页模式</label>
        <el-tooltip :content="flowMode" placement="top">
          <el-switch
            v-model="flow"
            active-value="scrolled"
            inactive-value="paginated"
            @change="switchFlow"
          />
        </el-tooltip>
      </div>
    </div>

    <button class="menu-reset-button app-secondary-button" @click="resetStyle">
      恢复默认排版
    </button>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watch, type PropType } from 'vue'
import { useReaderConfigStore } from '@/store/readerConfigStore'
import { storeToRefs } from 'pinia'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { confirm } from '@tauri-apps/plugin-dialog'
import { WINDOW_EVENTS } from '@/constants/events'
import { buildReaderFontOptions } from '@/services/reader/systemFontService'
import { DEFAULT_READER_FONT } from '@/types/readerFonts'
import {
  getAppliedAppThemeMode,
  syncReaderConfigThemeColors,
} from '@/services/theme/themeService'
import type { AppThemeMode } from '@/services/settings/appSettingsService'

type NumericSettingKey =
  | 'indent'
  | 'fontSize'
  | 'fontWeight'
  | 'letterSpacing'
  | 'lineSpacing'
  | 'paragraphSpacing'
  | 'boxPaddingHorizontal'
  | 'boxPaddingTop'
  | 'boxPaddingBottom'
  | 'columnCount'

interface ReaderNumericSetting {
  label: string
  value: number
  key: NumericSettingKey
  amount: number
  min: number
  max: number
  precision: number
}

export default defineComponent({
  name: 'StyleMenu',
  props: {
    maxHeight: {
      type: Number,
      default: null,
    },
    themeMode: {
      type: String as PropType<AppThemeMode>,
      default: 'light',
    },
  },
  emits: ['open-font-dialog'],
  setup(props, { emit }) {
    const readerConfigStore = useReaderConfigStore()
    const { readerConfig } = storeToRefs(readerConfigStore)

    const menuElement = ref<HTMLElement | null>(null)
    const selectedFont = ref(readerConfig.value.font)
    const settings = ref<ReaderNumericSetting[]>([
      {
        label: '首行缩进',
        value: readerConfig.value.indent,
        key: 'indent',
        amount: 1,
        min: 0,
        max: 10,
        precision: 0,
      },
      {
        label: '字体大小',
        value: readerConfig.value.fontSize,
        key: 'fontSize',
        amount: 1,
        min: 10,
        max: 30,
        precision: 0,
      },
      {
        label: '字重',
        value: readerConfig.value.fontWeight,
        key: 'fontWeight',
        amount: 100,
        min: 100,
        max: 900,
        precision: 0,
      },
      {
        label: '字间距',
        value: readerConfig.value.letterSpacing,
        key: 'letterSpacing',
        amount: 1,
        min: 0,
        max: 60,
        precision: 0,
      },
      {
        label: '行距',
        value: readerConfig.value.lineSpacing,
        key: 'lineSpacing',
        amount: 0.1,
        min: 0,
        max: 5,
        precision: 1,
      },
      {
        label: '段距',
        value: readerConfig.value.paragraphSpacing,
        key: 'paragraphSpacing',
        amount: 0.1,
        min: 0,
        max: 5,
        precision: 1,
      },
      {
        label: '水平边距',
        value: readerConfig.value.boxPaddingHorizontal,
        key: 'boxPaddingHorizontal',
        amount: 1,
        min: 0,
        max: 100,
        precision: 0,
      },
      {
        label: '页眉边距',
        value: readerConfig.value.boxPaddingTop,
        key: 'boxPaddingTop',
        amount: 1,
        min: 20,
        max: 100,
        precision: 0,
      },
      {
        label: '页脚边距',
        value: readerConfig.value.boxPaddingBottom,
        key: 'boxPaddingBottom',
        amount: 1,
        min: 20,
        max: 100,
        precision: 0,
      },
      {
        label: '栏数',
        value: readerConfig.value.columnCount,
        key: 'columnCount',
        amount: 1,
        min: 1,
        max: 2,
        precision: 0,
      },
    ])

    const flow = ref(readerConfig.value.flow)
    const flowMode = computed(() => {
      return flow.value === 'scrolled' ? '滚动翻页' : '分页翻页'
    })
    const fontOptions = computed(() => buildReaderFontOptions(readerConfig.value.enabledSystemFonts))
    const enabledFontCount = computed(() => readerConfig.value.enabledSystemFonts.length)
    const themeModeLabel = computed(() => {
      const currentTheme = props.themeMode || getAppliedAppThemeMode()
      return currentTheme === 'dark' ? '黑夜模式' : '白天模式'
    })
    const menuStyle = computed(() => {
      if (!props.maxHeight) {
        return undefined
      }

      return {
        maxHeight: `${props.maxHeight}px`,
      }
    })

    const updateVisual = () => {
      settings.value = settings.value.map((setting) => {
        setting.value = readerConfig.value[setting.key] as number
        return setting
      })
      selectedFont.value = readerConfig.value.font
      flow.value = readerConfig.value.flow
    }

    const emitStyleApplication = () => {
      getCurrentWebviewWindow().emitTo('reader', WINDOW_EVENTS.UPDATE_READER_STYLE)
    }

    const resetStyle = async () => {
      const confirmation = await confirm('确定要恢复默认排版吗？', {
        title: '恢复默认排版',
        kind: 'warning',
      })
      if (confirmation) {
        readerConfigStore.setDefaultConfig()
        readerConfigStore.setReaderConfig(
          syncReaderConfigThemeColors(readerConfig.value, props.themeMode)
        )
        selectedFont.value = DEFAULT_READER_FONT
        emitStyleApplication()
        updateVisual()
      }
    }

    const selectFont = (font: string) => {
      const fontExists = fontOptions.value.some((option) => option.value === font)
      const nextFont = fontExists ? font : DEFAULT_READER_FONT
      selectedFont.value = nextFont
      readerConfigStore.changeState('font', nextFont)
      emitStyleApplication()
      updateVisual()
    }

    const switchFlow = () => {
      readerConfigStore.changeState('flow', flow.value)
      emitStyleApplication()
    }

    const adjustSetting = (key: NumericSettingKey, value: number) => {
      readerConfigStore.changeState(key, value)
      emitStyleApplication()
    }

    const openFontDialog = () => {
      selectedFont.value = readerConfig.value.font
      emit('open-font-dialog')
    }

    watch(
      () => readerConfig.value.font,
      (font) => {
        selectedFont.value = font
      }
    )

    return {
      menuElement,
      menuStyle,
      selectedFont,
      settings,
      adjustSetting,
      resetStyle,
      selectFont,
      flow,
      flowMode,
      switchFlow,
      readerConfig,
      fontOptions,
      enabledFontCount,
      openFontDialog,
      themeModeLabel,
    }
  },
})
</script>

<style lang="scss" scoped>
label {
  font-size: 14px;
}

.menu {
  width: 290px;
  padding: 16px;
  box-sizing: content-box;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-default);
  background: var(--surface-raised);
  box-shadow: var(--shadow-lg);
  overflow: auto;
  backdrop-filter: blur(14px);

  .menu-hero {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-radius: var(--radius-lg);
    background: var(--surface-strong);
    border: 1px solid var(--border-default);
    box-shadow: var(--shadow-sm), var(--shadow-inset-light);
  }

  .menu-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .menu-subtitle {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-tertiary);
  }

  .menu-theme {
    .summary-pill {
      width: fit-content;
      display: inline-flex;
      align-items: center;
      padding: 5px 10px;
      border-radius: var(--radius-pill);
      background: var(--surface-brand-soft);
      color: var(--brand-primary);
      font-size: 12px;
      font-weight: 700;
    }
  }

  .section {
    margin-top: 14px;
    padding: 14px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-default);
    background: var(--surface-card);

    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
    }
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }

  .section-caption {
    font-size: 12px;
    color: var(--text-muted);
  }

  .font-section {
    .font-option {
      margin-top: 12px;
    }

    .font-select {
      width: 100%;
    }

    .font-summary {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
    }

    .summary-pill {
      width: fit-content;
      display: inline-flex;
      align-items: center;
      padding: 5px 10px;
      border-radius: var(--radius-pill);
      background: var(--surface-brand-soft);
      color: var(--brand-primary);
      font-size: 12px;
      font-weight: 700;
    }

    .font-manage-button {
      margin-top: 14px;
    }
  }

  .basic-section {
    .adjust-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 12px;

      &:first-child {
        margin-top: 0;
      }

      label {
        color: var(--text-secondary);
        font-size: 14px;
        font-weight: 700;
      }

      .input-number {
        width: 112px;
      }
    }
  }

  .extra-section {
    .flow-option {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 10px;

      label {
        color: var(--text-secondary);
        font-size: 14px;
        font-weight: 700;
      }
    }
  }

  .menu-reset-button {
    margin-top: 14px;
  }
}

:global(.style-menu-select-popper) {
  z-index: 4800 !important;
}
</style>
