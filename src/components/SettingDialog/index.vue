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

      <section class="section">
        <el-divider class="divider" content-position="left">TXT分章规则</el-divider>
        <div v-if="txtTocRules.length === 0" class="txt-toc-rule-empty">
          暂无可展示规则
        </div>
        <div v-else class="txt-toc-rule-list">
          <article
            v-for="(rule, index) in txtTocRules"
            :key="rule.id"
            class="txt-toc-rule-card"
          >
            <div class="txt-toc-rule-priority-actions">
              <button
                type="button"
                class="txt-toc-rule-order-btn"
                title="上移优先级"
                :disabled="index === 0"
                @click="moveRule(index, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                class="txt-toc-rule-order-btn"
                title="下移优先级"
                :disabled="index === txtTocRules.length - 1"
                @click="moveRule(index, 1)"
              >
                ↓
              </button>
            </div>

            <div class="txt-toc-rule-content">
              <div class="txt-toc-rule-header">
                <span class="txt-toc-rule-name">{{ rule.name }}</span>
                <el-switch v-model="rule.enable" />
              </div>
              <div class="txt-toc-rule-field">
                <span class="txt-toc-rule-label">样例</span>
                <p class="txt-toc-rule-example">{{ rule.example }}</p>
              </div>
              <div class="txt-toc-rule-field">
                <span class="txt-toc-rule-label">规则</span>
                <pre class="txt-toc-rule-regex">{{ rule.rule }}</pre>
              </div>
            </div>
          </article>
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
import {
  loadTxtTocRules,
  resequenceTxtTocRules,
  saveTxtTocRules,
} from '@/services/settings/txtTocRulesService'
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
      modelAPIKey: '',
      txtTocRules: [],
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
      this.txtTocRules = await loadTxtTocRules()
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
      await saveTxtTocRules(this.txtTocRules)
      await emitAppThemeUpdate(this.themeMode)
      this.$emit('close-dialog')
    },
    moveRule(currentIndex, offset) {
      const targetIndex = currentIndex + offset
      if (targetIndex < 0 || targetIndex >= this.txtTocRules.length) {
        return
      }

      const nextRules = [...this.txtTocRules]
      const currentRule = nextRules[currentIndex]
      nextRules[currentIndex] = nextRules[targetIndex]
      nextRules[targetIndex] = currentRule
      this.txtTocRules = resequenceTxtTocRules(nextRules)
    },
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

  .txt-toc-rule-empty {
    margin-top: 12px;
    color: var(--text-secondary);
    font-size: 13px;
  }

  .txt-toc-rule-list {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .txt-toc-rule-card {
    display: flex;
    gap: 10px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--surface-strong);
    padding: 10px;
    transition:
      border-color var(--duration-fast) var(--easing-standard),
      box-shadow var(--duration-fast) var(--easing-standard);
  }

  .txt-toc-rule-priority-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-self: center;
  }

  .txt-toc-rule-order-btn {
    width: 28px;
    height: 28px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-card);
    color: var(--text-primary);
    cursor: pointer;
    transition:
      border-color var(--duration-fast) var(--easing-standard),
      background-color var(--duration-fast) var(--easing-standard);

    &:hover:not(:disabled) {
      border-color: var(--border-brand);
      background: var(--surface-brand-soft);
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }

  .txt-toc-rule-content {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .txt-toc-rule-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .txt-toc-rule-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .txt-toc-rule-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .txt-toc-rule-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-secondary);
  }

  .txt-toc-rule-example {
    margin: 0;
    font-size: 12px;
    color: var(--text-secondary);
    word-break: break-word;
  }

  .txt-toc-rule-regex {
    margin: 0;
    padding: 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-default);
    background: var(--surface-card);
    color: var(--text-primary);
    font-size: 12px;
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-all;
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
