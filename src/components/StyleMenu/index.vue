<template>
  <div class="menu fade-in">
    <div class="color-section section">
      <span class="section-title">背景</span>
      <div id="color-box-selector">
        <span
          v-for="color in colors"
          :key="color"
          :style="{ backgroundColor: color }"
          class="color-box"
          @click="selectColor(color)"
        >
        </span>
      </div>
    </div>
    <div class="font-section section">
      <span class="section-title">字体</span>
      <div class="font-option">
        <el-radio-group
          class="font-radio-group"
          v-model="selectedFont"
        >
          <el-radio 
            v-for="font in fonts" 
            :key="font.name" 
            :value="font.name" 
            @click="selectFont(font.name)" 
            border
          >
            <span :style="`font-family: ${font.name};`">{{ font.display }}</span>
          </el-radio>
        </el-radio-group>
      </div>
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
import { defineComponent, ref, onMounted, computed } from 'vue'
import { useReaderConfigStore } from '@/store/readerConfigStore'
import { storeToRefs } from 'pinia'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { confirm } from '@tauri-apps/plugin-dialog'
import '@/css/ResetButton.css'

export default defineComponent({
  setup() {
    // 正式全局变量
    const readerConfigStore = useReaderConfigStore()
    // 全局状态变量，但只能访问不能修改
    const { readerConfig } = storeToRefs(readerConfigStore)

    const colors = ['#FFFFFF', '#faebd7', '#000000']
    const selectedFont = ref(readerConfig.value.font)
    const settings = ref([
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
        label: '行首边距',
        value: readerConfig.value.firstLineMargin,
        key: 'firstLineMargin',
        amount: 1,
        min: 36,
        max: 36,
        precision: 0,
      },
      {
        label: '行尾边距',
        value: readerConfig.value.lastLineMargin,
        key: 'lastLineMargin',
        amount: 1,
        min: 36,
        max: 36,
        precision: 0,
      },
      {
        label: '页眉边距',
        value: readerConfig.value.headerMargin,
        key: 'headerMargin',
        amount: 1,
        min: 0,
        max: 100,
        precision: 0,
      },
      {
        label: '页脚边距',
        value: readerConfig.value.footerMargin,
        key: 'footerMargin',
        amount: 1,
        min: 0,
        max: 100,
        precision: 0,
      },
      {
        label: '最小栏宽',
        value: readerConfig.value.minColumnWidth,
        key: 'minColumnWidth',
        amount: 1,
        min: 0,
        max: 150,
        precision: 0,
      },
      {
        label: '栏间距',
        value: readerConfig.value.columnSpacing,
        key: 'columnSpacing',
        amount: 1,
        min: 0,
        max: 150,
        precision: 0,
      },
    ])

    const fonts = [
      { name: 'system-ui', display: '默认' },
      { name: 'pingfang', display: '苹方' },
      { name: 'cursive', display: '草书' },
      { name: 'Roboto', display: 'Google Roboto' },
      { name: 'HiraginoMin', display: 'ヒラギノ明朝体' },
    ]

    // 翻页模式
    const flow = ref(readerConfig.value.flow)
    const flowMode = computed(() => {
      return flow.value === 'scrolled' ? '滚动翻页' : '分页翻页' 
    })

    // 样式视觉化更新
    const updateVisual = () => {
      settings.value = settings.value.map((setting) => {
        setting.value = readerConfig.value[setting.key]
        return setting
      })
      selectedFont.value = readerConfig.value.font
    }

    // 通知阅读器更新样式
    const emitStyleApplication = () => {
      getCurrentWebviewWindow().emitTo('reader', 'update-reader-style')
    }

    // 样式恢复默认
    const resetStyle = async () => {
      const confirmation = await confirm('确定要恢复默认样式吗？', {
        title: '恢复默认样式',
        kind: 'warning',
      })
      if (confirmation) {
        // 重置状态变量
        readerConfigStore.setDefaultConfig()
        // 阅读器样式更新
        emitStyleApplication()
        // 更新可视化
        updateVisual()
      }
    }

    // 选择背景颜色
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

    // 选择字体
    const selectFont = (font: string) => {
      readerConfigStore.changeState('font', font)
      emitStyleApplication()
      updateVisual()
    }

    // 切换翻页模式
    const switchFlow = () => {
      readerConfigStore.changeState('flow', flow.value)
      emitStyleApplication()
    }
 
    // 调整样式设置
    const adjustSetting = (key: string, value: number) => {
      // 更新状态全局变量
      readerConfigStore.changeState(key, value)
      // 通知阅读器更新样式
      emitStyleApplication()
    }

    onMounted(() => {
      const menuElement = document.querySelector('.menu') as HTMLElement
      if (menuElement) {
        const windowHeight = window.innerHeight
        const menuHeight = menuElement.offsetHeight
        menuElement.style.height = `${Math.min(
          windowHeight - 100,
          menuHeight
        )}px`
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
      flow,
      flowMode,
      switchFlow
    }
  },
})
</script>

<style lang="scss" scoped>
/* 组件浮现动画 */
@keyframes fadeIn {
  0% {
    opacity: 0;
    transform: translateY(-100px) scale(0.8);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.fade-in {
  animation: fadeIn 0.15s ease-in-out;
}

label {
  font-size: 14px;
}
.menu {
  background-color: white;
  padding: 10px;
  width: 200px;
  border-radius: 10px;
  box-shadow: var(--t-box-shadow-light);
  overflow: auto;

  &::-webkit-scrollbar {
    width: var(--t-scrollbar-width-thin);
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: var(--t-color-grey);
    /* 浅色背景 */
    border-radius: 6px;
    background-clip: content-box;
    display: none;
  }

  &:hover::-webkit-scrollbar-thumb {
    display: unset;
  }

  .section {
    padding-bottom: 10px;
    border-bottom: var(--t-border-thin-light);

    .section-title {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 5px;
    }
  }

  .color-section {
    display: flex;
    flex-direction: column;

    #color-box-selector {
      display: flex;

      .color-box {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid #ccc;
        margin-right: 8px;
        cursor: var(--t-mouse-cursor-link), pointer;
        transition: border 0.3s;

        &:hover {
          border-color: #999;
        }
      }
    }
  }

  .font-section {
    margin-top: 5px;

    .font-option {
      display: flex;
      align-items: center;
      margin-top: 0.225rem;

      .font-radio-group {
        gap: 0.25rem;

        :deep(.el-radio) {
          width: 100%;
          margin: 0;
        }
        :deep(.el-radio__label) {
          width: 100%;
          text-align: center;
        }
      }
    }
  }

  .basic-section {
    .adjust-option {
      display: flex;
      align-items: center;
      margin-top: 10px;
      justify-content: space-between;

      label {
        margin-right: 10px;
        font-size: 15px;
        font-weight: bold;
      }

      .input-number {
        width: 100px;
      }
    }
  }

  .extra-section {
    .flow-option {
      display: flex;
      justify-content: space-between;
      align-items: center;

      label {
        font-size: 15px;
        font-weight: bold;
      }
    }
  }
}
</style>
