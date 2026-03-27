<template>
  <div
    ref="menuElement"
    class="menu"
    :style="menuStyle"
  >
    <div class="menu-hero">
      <div class="menu-title">阅读样式</div>
      <div class="menu-subtitle">在这里修改背景、调整字距，并启用你最喜爱的字体。</div>
    </div>

    <div class="color-section section">
      <span class="section-title">背景</span>
      <div id="color-box-selector">
        <button
          v-for="color in colors"
          :key="color"
          :style="{ backgroundColor: color }"
          class="color-box"
          :class="{ 'color-box--active': readerConfig.color === color }"
          @click="selectColor(color)"
        >
          <span v-if="readerConfig.color === color" class="color-box-check">✓</span>
        </button>
      </div>
    </div>

    <div class="font-section section">
      <div class="section-head">
        <span class="section-title">字体</span>
        <span class="section-caption">仅展示系统默认与已启用字体</span>
      </div>

      <div class="font-option">
        <el-select
          v-model="selectedFont"
          placeholder="系统默认（PingFang）"
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

      <div class="font-summary">
        <span class="summary-pill">已启用 {{ enabledFontCount }} 款系统字体</span>
      </div>

      <button class="font-manage-button" @click="openFontDialog">
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
            style="--el-switch-on-color: #f2b94b; --el-switch-off-color: #13ce66"
            active-value="scrolled"
            inactive-value="paginated"
            @change="switchFlow"
          >
          </el-switch>
        </el-tooltip>
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
import { computed, defineComponent, ref, watch } from 'vue'
import { useReaderConfigStore } from '@/store/readerConfigStore'
import { storeToRefs } from 'pinia'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { confirm } from '@tauri-apps/plugin-dialog'
import '@/css/ResetButton.css'
import { WINDOW_EVENTS } from '@/constants/events'
import { buildReaderFontOptions } from '@/services/reader/systemFontService'
import { DEFAULT_READER_FONT } from '@/types/readerFonts'

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
  },
  emits: ['open-font-dialog'],
  setup(props, { emit }) {
    const readerConfigStore = useReaderConfigStore()
    const { readerConfig } = storeToRefs(readerConfigStore)

    const menuElement = ref<HTMLElement | null>(null)
    const colors = ['#FFFFFF', '#faebd7', '#000000']
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
      const confirmation = await confirm('确定要恢复默认样式吗？', {
        title: '恢复默认样式',
        kind: 'warning',
      })
      if (confirmation) {
        readerConfigStore.setDefaultConfig()
        selectedFont.value = DEFAULT_READER_FONT
        emitStyleApplication()
        updateVisual()
      }
    }

    const selectColor = (color: string) => {
      if (color === '#000000') {
        readerConfigStore.changeState('fontColor', '#FFFFFF')
        readerConfigStore.changeState('color', color)
      } else {
        readerConfigStore.changeState('fontColor', '#000000')
        readerConfigStore.changeState('color', color)
      }
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
      colors,
      selectedFont,
      settings,
      selectColor,
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
  border-radius: 20px;
  border: 1px solid rgba(226, 232, 240, 0.92);
  background: rgba(248, 250, 252, 0.98);
  box-shadow:
    0 18px 40px rgba(15, 23, 42, 0.12),
    0 6px 16px rgba(15, 23, 42, 0.08);
  overflow: auto;

  &::-webkit-scrollbar {
    width: var(--t-scrollbar-width-thin);
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: rgba(148, 163, 184, 0.36);
    border-radius: 999px;
  }

  .menu-hero {
    padding: 16px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.94);
    border: 1px solid rgba(226, 232, 240, 0.92);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
  }

  .menu-title {
    font-size: 22px;
    font-weight: 700;
    color: #0f172a;
  }

  .menu-subtitle {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.7;
    color: #64748b;
  }

  .section {
    margin-top: 14px;
    padding: 14px;
    border-radius: 18px;
    border: 1px solid #edf0f4;
    background: rgba(255, 255, 255, 0.9);

    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: #1f2937;
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
    color: #94a3b8;
  }

  .color-section {
    display: flex;
    flex-direction: column;

    #color-box-selector {
      display: flex;
      gap: 10px;
      margin-top: 12px;
    }

    .color-box {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 2px solid rgba(148, 163, 184, 0.4);
      display: inline-flex;
      justify-content: center;
      align-items: center;
      cursor: var(--t-mouse-cursor-link), pointer;
      transition:
        transform 0.2s ease,
        box-shadow 0.2s ease,
        border-color 0.2s ease;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12);
      }
    }

    .color-box--active {
      border-color: #2563eb;
      box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
    }

    .color-box-check {
      color: #0f172a;
      font-size: 12px;
      font-weight: 700;
      text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
    }
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
      border-radius: 999px;
      background: rgba(59, 130, 246, 0.08);
      color: #2563eb;
      font-size: 12px;
      font-weight: 700;
    }

    .summary-text {
      font-size: 12px;
      line-height: 1.6;
      color: #64748b;
    }

    .font-manage-button {
      margin-top: 14px;
      width: 100%;
      height: 40px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 14px;
      background: #ffffff;
      color: #334155;
      font-size: 14px;
      font-weight: 700;
      transition:
        transform 0.2s ease,
        box-shadow 0.2s ease,
        border-color 0.2s ease;

      &:hover {
        transform: translateY(-1px);
        border-color: rgba(59, 130, 246, 0.22);
        box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
        color: #1d4ed8;
      }
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
        color: #334155;
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
        color: #334155;
        font-size: 14px;
        font-weight: 700;
      }
    }
  }
}

:deep(.font-select .el-select__wrapper) {
  min-height: 42px;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 0 0 1px rgba(226, 232, 240, 0.96) inset !important;
}

:deep(.font-select .el-select__wrapper.is-focused) {
  box-shadow:
    0 0 0 1px rgba(59, 130, 246, 0.28) inset,
    0 0 0 4px rgba(59, 130, 246, 0.08) !important;
}

:global(.style-menu-select-popper) {
  z-index: 4800 !important;
}

:deep(.input-number.el-input-number) {
  --el-input-number-controls-height: 40px;
  --el-input-height: 40px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.96);
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
}

:deep(.input-number .el-input__wrapper) {
  border-radius: 0;
  background: #ffffff;
  box-shadow: none !important;
}

:deep(.input-number .el-input__wrapper.is-focus) {
  box-shadow: none !important;
}

:deep(.input-number .el-input-number__decrease),
:deep(.input-number .el-input-number__increase) {
  width: 32px;
  background: #f8fafc;
  color: #475569;
  border-left: 1px solid rgba(226, 232, 240, 0.96);
  transition: background-color 0.18s ease, color 0.18s ease;
}

:deep(.input-number .el-input-number__decrease) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

:deep(.input-number .el-input-number__increase) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-top-right-radius: 12px;
}

:deep(.input-number .el-input-number__decrease:hover),
:deep(.input-number .el-input-number__increase:hover) {
  background: #eff6ff;
  color: #1d4ed8;
}

:deep(.input-number.is-controls-right .el-input-number__decrease) {
  border-bottom-right-radius: 12px;
}

:deep(.input-number.is-controls-right .el-input-number__increase) {
  border-top-right-radius: 12px;
}

:deep(.input-number.is-controls-right .el-input__inner) {
  padding-right: 40px;
}

:deep(.input-number:hover) {
  border-color: rgba(148, 163, 184, 0.42);
}

:deep(.input-number:focus-within) {
  border-color: rgba(59, 130, 246, 0.28);
  box-shadow:
    0 4px 14px rgba(15, 23, 42, 0.04),
    0 0 0 4px rgba(59, 130, 246, 0.08);
}
</style>
