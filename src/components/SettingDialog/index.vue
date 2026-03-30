<template>
  <el-dialog
    align-center
    destroy-on-close
    title="设置中心"
    class="dialog-wrapper"
    :append-to-body="true"
    :show-close="false"
    :close-on-press-escape="false"
    @open="onOpen"
  >
    <div class="dialog-content">
      <section class="section section--theme">
        <el-divider class="divider" content-position="left">界面主题</el-divider>
        <div class="theme-mode-group">
          <button
            type="button"
            class="theme-mode-card"
            :class="{ 'is-active': themeMode === 'light' }"
            @click="themeMode = 'light'"
          >
            <span class="theme-mode-title">白天模式☀️</span>
          </button>
          <button
            type="button"
            class="theme-mode-card"
            :class="{ 'is-active': themeMode === 'dark' }"
            @click="themeMode = 'dark'"
          >
            <span class="theme-mode-title">黑夜模式🌙</span>
          </button>
        </div>
      </section>

      <section class="section">
        <el-divider class="divider" content-position="left">云同步</el-divider>
        <div class="select-container">
          <label class="field-label">云同步平台</label>
          <el-select v-model="webdavUrlRoot" placeholder="请选择">
            <el-option
              v-for="item in platformList"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>
        <div class="input-container">
          <label class="field-label">文件目录</label>
          <el-input v-model="webdavUrlFolder" placeholder="请输入云同步的目录">
            <template #prepend>({{ webdavUrlRoot }})</template>
          </el-input>
        </div>
        <div class="input-container">
          <label class="field-label">用户名</label>
          <el-input v-model="webdavUsername" placeholder="请输入用户名" />
        </div>
        <div class="input-container">
          <label class="field-label">密码</label>
          <el-input
            v-model="webdavPassword"
            type="password"
            placeholder="请输入密码"
            show-password
          />
        </div>
      </section>

      <section class="section">
        <el-divider class="divider" content-position="left">AI大模型</el-divider>
        <div class="switch-container">
          <label class="field-label">是否开启</label>
          <el-switch v-model="isAiAssistantEnabled" />
        </div>
        <div class="select-container">
          <label class="field-label">模型编码</label>
          <el-select
            v-model="modelValue"
            placeholder="请选择"
            :disabled="!isAiAssistantEnabled"
          >
            <el-option
              v-for="item in modelList"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>
        <div class="input-container">
          <label class="field-label">模型路径</label>
          <el-input
            v-model="modelUrl"
            :readonly="true"
            :disabled="!isAiAssistantEnabled"
          />
        </div>
        <div class="input-container">
          <label class="field-label">API key</label>
          <el-input
            v-model="modelAPIKey"
            type="password"
            show-password
            :disabled="!isAiAssistantEnabled"
          />
        </div>
      </section>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" @click="saveSetting">保存</el-button>
        <el-button @click="$emit('close-dialog')">取消</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script>
import {
  loadAppSettings,
  saveAppSettings,
} from '@/services/settings/appSettingsService'
import { emitAppThemeUpdate } from '@/services/theme/themeService'

export default {
  name: 'SettingDialog',
  emits: ['close-dialog'],
  data() {
    return {
      settings: {},
      themeMode: 'light',
      webdavUrlRoot: '',
      webdavUrlFolder: '',
      webdavUsername: '',
      webdavPassword: '',
      platformList: [
        { value: 'https://dav.jianguoyun.com/dav/', label: '坚果云' }
      ],
      isAiAssistantEnabled: false,
      modelValue: '',
      modelList: [
        { value: 'glm-4-flash', label: '智谱清言' },
        { value: 'deepseek-v3', label: 'DeepSeek-V3(阿里云百炼)' }
      ],
      modelAPIKey: ''
    };
  },
  computed: {
    webdavUrl() {
      if (!this.webdavUrlFolder) {
        return ''
      }
      if (this.webdavUrlFolder.endsWith('/')) {
        return this.webdavUrlRoot + this.webdavUrlFolder
      }
      return this.webdavUrlRoot + this.webdavUrlFolder + '/'
    },
    modelUrl() {
      if (this.modelValue === '') {
        return ''
      } else if (this.modelValue === 'glm-4-flash') {
        return 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
      } else if (this.modelValue === 'deepseek-v3') {
        return 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
      }

      return ''
    }
  },
  methods: {
    async onOpen() {
      const loadedSettings = await loadAppSettings()
      this.settings = loadedSettings
      this.themeMode = loadedSettings.themeMode
      this.webdavUrlRoot = loadedSettings.webdavUrlRoot
      this.webdavUrlFolder = loadedSettings.webdavUrlFolder
      this.webdavUsername = loadedSettings.webdavUser
      this.webdavPassword = loadedSettings.webdavPass
      this.isAiAssistantEnabled = loadedSettings.isAiEnabled === 'true'
      this.modelValue = loadedSettings.modelName
      this.modelAPIKey = loadedSettings.modelApiKey
    },
    async saveSetting() {
      const nextSettings = {
        webdavUrlRoot: this.webdavUrlRoot,
        webdavUrlFolder: this.webdavUrlFolder,
        webdavUrl: this.webdavUrl,
        webdavUser: this.webdavUsername,
        webdavPass: this.webdavPassword,
        isAiEnabled: this.isAiAssistantEnabled.toString(),
        modelName: this.modelValue,
        modelUrl: this.modelUrl,
        modelApiKey: this.modelAPIKey,
        themeMode: this.themeMode,
      }

      this.settings = nextSettings
      await saveAppSettings(nextSettings)
      await emitAppThemeUpdate(this.themeMode)
      this.$emit('close-dialog')
    }
  },
};
</script>

<style scoped lang="scss">
.dialog-wrapper {
  max-width: min(640px, calc(100vw - 32px));
  max-height: 78vh;
  overflow: hidden;

  .dialog-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: calc(78vh - 84px);
    overflow-y: auto;
    padding-right: 4px;
  }

  .section {
    padding: 0 14px 14px;
    margin-top: 10px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    background: var(--surface-card);

    &--theme {
      background: var(--surface-card);
    }
  }

  .divider {
    margin-top: 0;

    & :deep(.el-divider__text) {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-primary);
    }
  }

  .field-label {
    display: inline-flex;
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--text-secondary);
    font-weight: 700;
  }

  .input-container,
  .select-container {
    margin-top: 12px;
  }

  .switch-container {
    margin-top: 12px;
    display: inline-flex;
    gap: 12px;
    justify-content: center;
    align-items: center;
  }

  .theme-mode-group {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .theme-mode-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    background: var(--surface-strong);
    box-shadow: var(--shadow-sm);
    color: var(--text-secondary);
    text-align: left;
    transition:
      transform var(--duration-fast) var(--easing-standard),
      box-shadow var(--duration-fast) var(--easing-standard),
      border-color var(--duration-fast) var(--easing-standard),
      background-color var(--duration-fast) var(--easing-standard);

    &:hover {
      transform: translateY(-2px);
      border-color: var(--border-brand);
      box-shadow: var(--shadow-md);
    }

    &.is-active {
      border-color: var(--brand-primary);
      background: var(--surface-brand-soft);
      box-shadow:
        var(--shadow-md),
        0 0 0 1px var(--ring-brand-soft) inset;
    }
  }

  .theme-mode-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}

@media (max-width: 720px) {
  .dialog-wrapper {
    .theme-mode-group {
      grid-template-columns: 1fr;
    }
  }
}
</style>
