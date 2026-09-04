<template>
  <div ref="menuElement" class="menu" :style="menuStyle">
    <div class="reader-config-section section">
      <section class="section-head">
        <span class="section-title">主题</span>
      </section>
      <div class="basic-option">
        <span class="option-title">背景</span>
        <div class="background-select">
          <el-select
            :model-value="activeBackgroundPreset"
            class="background-select-input"
            popper-class="style-menu-select-popper"
            @change="selectBackgroundPreset"
          >
            <el-option
              v-for="option in backgroundPresetOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            >
              <div class="background-option">
                <span class="background-option-preview" :style="buildPreviewStyle(option)"></span>
                <span class="background-option-label">{{ option.label }}</span>
              </div>
            </el-option>
          </el-select>
        </div>
      </div>

      <div class="basic-option">
        <span class="option-title">字体</span>
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
    </div>

    <div class="common-section section">
      <span class="section-title">通用</span>
      <div v-for="(setting, index) in settings" :key="index" class="adjust-option">
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
      <div class="extra-option">
        <label>翻页模式</label>
        <el-select
          v-model="flow"
          class="extra-select"
          popper-class="style-menu-select-popper"
          @change="switchFlow"
        >
          <el-option
            v-for="option in flowOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>
      <div class="extra-option">
        <label>EPUB 内置样式</label>
        <el-select
          v-model="epubBuiltInStylesheetMode"
          class="extra-select"
          popper-class="style-menu-select-popper"
          @change="switchEpubBuiltInStylesheetMode"
        >
          <el-option
            v-for="option in epubBuiltInStylesheetOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>
      <p class="epub-stylesheet-tip">切换后在下次打开书籍时生效</p>
    </div>

    <el-button class="menu-reset-button" @click="resetStyle">恢复默认样式</el-button>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watch, type PropType } from 'vue'
import { confirm } from '@tauri-apps/plugin-dialog'
import { useReaderConfig, type EpubBuiltInStylesheetMode } from '@/services/reader/config'
import { buildReaderFontOptions } from '@/services/reader/systemFonts'
import { dispatchReaderStyleUpdate } from '@/services/ipc'
import { DEFAULT_READER_FONT } from '@/services/reader/fontTypes'
import {
  getAppliedAppThemeMode,
  getReaderBackgroundPresetOptions,
  syncReaderConfigThemeColors,
  type ReaderBackgroundPresetOption,
} from '@/services/theme'
import type { AppThemeMode } from '@/services/settings'
import type {
  ReaderBackgroundPreset,
  ReaderBackgroundPresets,
  ReaderDarkBackgroundPreset,
  ReaderLightBackgroundPreset,
} from '@/services/theme/backgroundTypes'

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
  setup(props) {
    type ReaderFlowToggleValue = 'paginated' | 'scrolled'
    const readerConfigStore = useReaderConfig()
    const { readerConfig } = readerConfigStore

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

    const normalizeFlowToggleValue = (value: string): ReaderFlowToggleValue => {
      return value === 'paginated' ? 'paginated' : 'scrolled'
    }
    const flowOptions = [
      { label: '分页翻页', value: 'paginated' },
      { label: '滚动翻页', value: 'scrolled' },
    ] as { label: string; value: ReaderFlowToggleValue }[]
    const epubBuiltInStylesheetOptions = [
      { label: '移除', value: 'removed' },
      { label: '智能', value: 'filtered' },
      { label: '保留', value: 'preserved' },
    ] as const

    const currentThemeMode = computed<AppThemeMode>(() => {
      return props.themeMode || getAppliedAppThemeMode()
    })
    const flow = ref<ReaderFlowToggleValue>(normalizeFlowToggleValue(readerConfig.value.flow))
    const epubBuiltInStylesheetMode = ref<EpubBuiltInStylesheetMode>(
      readerConfig.value.epubBuiltInStylesheetMode,
    )
    const fontOptions = computed(() =>
      buildReaderFontOptions(readerConfig.value.enabledSystemFonts),
    )
    const backgroundPresetOptions = computed(() => {
      return getReaderBackgroundPresetOptions(currentThemeMode.value)
    })
    const activeBackgroundPreset = computed(() => {
      return readerConfig.value.backgroundPresets[currentThemeMode.value]
    })
    const buildPreviewStyle = (
      option: ReaderBackgroundPresetOption<ReaderBackgroundPreset>,
    ): Record<string, string> => {
      const style: Record<string, string> = {
        backgroundColor: option.preview,
      }

      if (option.previewBackgroundImage) {
        style.backgroundImage = option.previewBackgroundImage
      }
      if (option.previewBackgroundSize) {
        style.backgroundSize = option.previewBackgroundSize
      }
      if (option.previewBackgroundPosition) {
        style.backgroundPosition = option.previewBackgroundPosition
      }

      return style
    }
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
      flow.value = normalizeFlowToggleValue(readerConfig.value.flow)
      epubBuiltInStylesheetMode.value = readerConfig.value.epubBuiltInStylesheetMode
    }

    const emitStyleApplication = () => {
      void dispatchReaderStyleUpdate()
    }

    const buildBackgroundPresetsForCurrentTheme = (
      preset: ReaderBackgroundPreset,
    ): ReaderBackgroundPresets => {
      if (currentThemeMode.value === 'dark') {
        return {
          ...readerConfig.value.backgroundPresets,
          dark: preset as ReaderDarkBackgroundPreset,
        }
      }

      return {
        ...readerConfig.value.backgroundPresets,
        light: preset as ReaderLightBackgroundPreset,
      }
    }

    const syncCurrentThemeCompatColors = () => {
      readerConfigStore.setReaderConfig(
        syncReaderConfigThemeColors(readerConfig.value, currentThemeMode.value),
      )
    }

    const resetStyle = async () => {
      const confirmation = await confirm('确定要恢复当前主题的默认阅读样式吗？', {
        title: '恢复默认样式',
        kind: 'warning',
      })
      if (confirmation) {
        const nextBackgroundPresets = buildBackgroundPresetsForCurrentTheme('default')
        readerConfigStore.setDefaultConfig()
        readerConfigStore.changeState('backgroundPresets', nextBackgroundPresets)
        selectedFont.value = DEFAULT_READER_FONT
        syncCurrentThemeCompatColors()
        emitStyleApplication()
        updateVisual()
      }
    }

    const selectBackgroundPreset = (preset: ReaderBackgroundPreset) => {
      readerConfigStore.changeState(
        'backgroundPresets',
        buildBackgroundPresetsForCurrentTheme(preset),
      )
      syncCurrentThemeCompatColors()
      emitStyleApplication()
    }

    const selectFont = (font: string) => {
      const fontExists = fontOptions.value.some((option) => option.value === font)
      const nextFont = fontExists ? font : DEFAULT_READER_FONT
      selectedFont.value = nextFont
      readerConfigStore.changeState('font', nextFont)
      emitStyleApplication()
      updateVisual()
    }

    const switchFlow = (value?: ReaderFlowToggleValue) => {
      const nextFlow = normalizeFlowToggleValue(value || flow.value)
      flow.value = nextFlow
      readerConfigStore.changeState('flow', nextFlow)
      emitStyleApplication()
    }

    const switchEpubBuiltInStylesheetMode = (value: EpubBuiltInStylesheetMode) => {
      epubBuiltInStylesheetMode.value = value
      readerConfigStore.changeState('epubBuiltInStylesheetMode', value)
    }

    const adjustSetting = (key: NumericSettingKey, value: number) => {
      readerConfigStore.changeState(key, value)
      emitStyleApplication()
    }

    watch(
      () => readerConfig.value.font,
      (font) => {
        selectedFont.value = font
      },
    )

    watch(
      () => readerConfig.value.epubBuiltInStylesheetMode,
      (mode) => {
        epubBuiltInStylesheetMode.value = mode
      },
    )

    return {
      activeBackgroundPreset,
      adjustSetting,
      backgroundPresetOptions,
      buildPreviewStyle,
      epubBuiltInStylesheetMode,
      epubBuiltInStylesheetOptions,
      flow,
      flowOptions,
      fontOptions,
      menuElement,
      menuStyle,
      readerConfig,
      resetStyle,
      selectBackgroundPreset,
      selectFont,
      selectedFont,
      settings,
      switchEpubBuiltInStylesheetMode,
      switchFlow,
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
    align-items: center;
    gap: 12px;
  }

  .reader-config-section {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .basic-option {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .option-title {
        color: var(--text-secondary);
        font-size: 14px;
        font-weight: 700;
      }
    }

    .background-select {
      display: flex;
      align-items: center;
      min-width: 0;
    }

    .background-select-input {
      width: 180px;
    }

    .font-select {
      width: 180px;
    }
  }

  .common-section {
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
    display: flex;
    flex-direction: column;
    gap: 12px;

    .extra-option {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;

      label {
        color: var(--text-secondary);
        font-size: 14px;
        font-weight: 700;
        white-space: nowrap;
      }

      .extra-select {
        width: 140px;
      }
    }

    .epub-stylesheet-tip {
      margin: 0;
      color: var(--text-tertiary);
      font-size: 12px;
      line-height: 1.4;
    }
  }

  .menu-reset-button {
    width: 100%;
    min-height: 42px;
    margin-top: 14px;
  }
}

:global(.style-menu-select-popper) {
  z-index: 4800 !important;
}

// 背景预设选项内的预览：选项内容会被 el-select 传送到 body，需用全局选择器保证样式生效
:global(.style-menu-select-popper .background-option) {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 100%;
  line-height: 1;
}

:global(.style-menu-select-popper .background-option-preview) {
  display: block;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 4px;
  border: 1px solid var(--border-emphasis);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.08);
}

:global(.style-menu-select-popper .background-option-label) {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  line-height: 1;
}
</style>
