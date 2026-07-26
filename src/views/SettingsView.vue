<template>
  <div class="settings-page">
    <div class="settings-page-scroll">
      <div class="settings-content">
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

            <template v-if="!isEditing">
              <div class="purpose-tabs">
                <el-radio-group v-model="activePurpose" size="small">
                  <el-radio-button value="chat">对话</el-radio-button>
                  <el-radio-button value="image">图像</el-radio-button>
                  <el-radio-button value="embedding">嵌入</el-radio-button>
                  <el-radio-button value="rerank">重排序</el-radio-button>
                </el-radio-group>
              </div>

              <div v-if="currentProvider" class="model-card">
                <div class="model-card-body">
                  <div class="model-card-field">
                    <span class="model-card-label">API格式</span>
                    <span class="model-card-value">{{ currentProvider.providerType }}</span>
                  </div>
                  <div class="model-card-field">
                    <span class="model-card-label">模型ID</span>
                    <span class="model-card-value">{{ currentProvider.modelId }}</span>
                  </div>
                  <div class="model-card-field">
                    <span class="model-card-label">请求地址</span>
                    <span class="model-card-value"
                      >{{ currentProvider.baseUrl }}{{ currentProvider.endpoint }}</span
                    >
                  </div>
                </div>
                <div class="model-card-actions">
                  <el-button size="small" @click="startEdit">编辑</el-button>
                  <el-button size="small" type="danger" @click="deleteProvider">删除</el-button>
                </div>
              </div>

              <div v-else class="model-empty">
                <p>暂无{{ purposeLabel }}模型配置</p>
                <el-button type="primary" size="small" @click="startAdd">添加</el-button>
              </div>
            </template>

            <!-- Edit state -->
            <ModelProviderForm
              v-else
              :provider="editingProvider"
              :readonly-purpose="!isAdding"
              @submit="handleFormSubmit"
              @cancel="handleFormCancel"
            />
          </section>

          <section class="section">
            <el-divider class="divider" content-position="left">TXT分章规则</el-divider>
            <div v-if="txtTocRules.length === 0" class="txt-toc-rule-empty">暂无可展示规则</div>
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
      </div>
    </div>
  </div>
</template>

<script>
import { loadAppSettings, saveAppSettings } from '@/services/settings/appSettingsService'
import {
  loadTxtTocRules,
  resequenceTxtTocRules,
  saveTxtTocRules,
} from '@/services/settings/txtTocRulesService'
import { emitAppThemeUpdate } from '@/services/theme/themeService'
import { PURPOSE_LABELS } from '@/types/model'
import ModelProviderForm from '@/components/SettingDialog/ModelProviderForm.vue'
import { logWarn } from '@/utils/logger'

const AUTO_SAVE_DELAY_MS = 200

export default {
  name: 'SettingsView',
  components: { ModelProviderForm },
  data() {
    return {
      settings: {},
      themeMode: 'light',
      webdavUrlRoot: '',
      webdavUrlFolder: '',
      webdavUsername: '',
      webdavPassword: '',
      platformList: [{ value: 'https://dav.jianguoyun.com/dav/', label: '坚果云' }],
      modelProviders: {
        chat: null,
        image: null,
        embedding: null,
        rerank: null,
      },
      activePurpose: 'chat',
      isEditing: false,
      isAdding: false,
      editingProvider: null,
      txtTocRules: [],
      isLoadingSettings: false,
      autoSaveTimer: null,
      lastSavedSnapshot: '',
      lastSavedThemeMode: 'light',
      hasLoadedSettings: false,
    }
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
    currentProvider() {
      return this.modelProviders[this.activePurpose] ?? null
    },
    purposeLabel() {
      return PURPOSE_LABELS[this.activePurpose] ?? ''
    },
  },
  watch: {
    themeMode() {
      this.scheduleAutoSave()
    },
    webdavUrlRoot() {
      this.scheduleAutoSave()
    },
    webdavUrlFolder() {
      this.scheduleAutoSave()
    },
    webdavUsername() {
      this.scheduleAutoSave()
    },
    webdavPassword() {
      this.scheduleAutoSave()
    },
    modelProviders: {
      deep: true,
      handler() {
        this.scheduleAutoSave()
      },
    },
    txtTocRules: {
      deep: true,
      handler() {
        this.scheduleAutoSave()
      },
    },
  },
  mounted() {
    void this.loadSettings()
  },
  beforeUnmount() {
    void this.flushAutoSaveSettings()
  },
  methods: {
    async loadSettings() {
      if (this.hasLoadedSettings) {
        await this.flushAutoSaveSettings()
      }

      this.isLoadingSettings = true

      try {
        const loadedSettings = await loadAppSettings()
        this.settings = loadedSettings
        this.themeMode = loadedSettings.themeMode
        this.webdavUrlRoot = loadedSettings.webdavUrlRoot
        this.webdavUrlFolder = loadedSettings.webdavUrlFolder
        this.webdavUsername = loadedSettings.webdavUser
        this.webdavPassword = loadedSettings.webdavPass
        this.modelProviders = { ...loadedSettings.modelProviders }
        this.txtTocRules = await loadTxtTocRules()
        this.lastSavedThemeMode = loadedSettings.themeMode
        this.lastSavedSnapshot = this.createSettingsSnapshot()
        this.hasLoadedSettings = true
      } catch (error) {
        logWarn('SettingsView', 'load-settings failed', error)
      } finally {
        this.isLoadingSettings = false
      }
    },
    buildNextSettings() {
      return {
        webdavUrlRoot: this.webdavUrlRoot,
        webdavUrlFolder: this.webdavUrlFolder,
        webdavUrl: this.webdavUrl,
        webdavUser: this.webdavUsername,
        webdavPass: this.webdavPassword,
        modelProviders: this.modelProviders,
        themeMode: this.themeMode,
      }
    },
    createSettingsSnapshot() {
      return JSON.stringify({
        settings: this.buildNextSettings(),
        txtTocRules: this.txtTocRules,
      })
    },
    clearAutoSaveTimer() {
      if (this.autoSaveTimer) {
        clearTimeout(this.autoSaveTimer)
        this.autoSaveTimer = null
      }
    },
    scheduleAutoSave() {
      if (this.isLoadingSettings || !this.hasLoadedSettings) {
        return
      }

      this.clearAutoSaveTimer()
      this.autoSaveTimer = setTimeout(() => {
        this.autoSaveTimer = null
        void this.autoSaveSettings()
      }, AUTO_SAVE_DELAY_MS)
    },
    async flushAutoSaveSettings() {
      this.clearAutoSaveTimer()
      await this.autoSaveSettings()
    },
    async autoSaveSettings() {
      if (!this.hasLoadedSettings) {
        return
      }

      const snapshot = this.createSettingsSnapshot()
      if (snapshot === this.lastSavedSnapshot) {
        return
      }

      const nextSettings = this.buildNextSettings()
      const shouldEmitThemeUpdate = this.themeMode !== this.lastSavedThemeMode
      this.settings = nextSettings

      try {
        await saveAppSettings(nextSettings)
        await saveTxtTocRules(this.txtTocRules)
        if (shouldEmitThemeUpdate) {
          await emitAppThemeUpdate(this.themeMode)
          this.lastSavedThemeMode = this.themeMode
        }
        this.lastSavedSnapshot = snapshot
      } catch (error) {
        logWarn('SettingsView', 'auto-save-settings failed', error)
      }
    },
    startEdit() {
      this.isEditing = true
      this.isAdding = false
      this.editingProvider = { ...this.currentProvider }
    },
    startAdd() {
      this.isEditing = true
      this.isAdding = true
      this.editingProvider = {
        purpose: this.activePurpose,
        providerType: 'OpenAI',
        baseUrl: '',
        endpoint: '',
        modelId: '',
        apiKey: '',
      }
    },
    handleFormSubmit(provider) {
      this.modelProviders = {
        ...this.modelProviders,
        [provider.purpose]: provider,
      }
      this.isEditing = false
      this.isAdding = false
      this.editingProvider = null
    },
    handleFormCancel() {
      this.isEditing = false
      this.isAdding = false
      this.editingProvider = null
    },
    deleteProvider() {
      this.modelProviders = {
        ...this.modelProviders,
        [this.activePurpose]: null,
      }
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
}
</script>

<style scoped lang="scss">
.settings-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 24px 28px 0;
  overflow: hidden;
  color: var(--text-primary);
  background: var(--app-bg-accent);
}

.settings-page-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: var(--t-scrollbar-width-thin);
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: var(--radius-pill);
  }
}

.settings-content {
  width: min(920px, 100%);
  margin: 0 auto;

  .dialog-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 0 4px 24px 0;
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

  // Model provider styles
  .purpose-tabs {
    position: relative;
    margin-bottom: 12px;
    top: -6px;

    :deep(.el-radio-group) {
      background-color: var(--surface-inset);
      padding: 6px 4px;
      border-radius: var(--radius-sm);
      display: inline-flex;
      gap: 4px;
    }

    :deep(.el-radio-button) {
      --el-radio-button-checked-bg-color: transparent;
      --el-radio-button-checked-text-color: var(--text-primary);
      --el-radio-button-checked-border-color: transparent;

      .el-radio-button__inner {
        border: none !important;
        box-shadow: none !important;
        background-color: transparent;
        color: var(--text-secondary);
        border-radius: calc(var(--radius-sm) - 4px) !important;
        padding: 6px 16px;
        transition:
          background-color var(--duration-fast) var(--easing-standard),
          color var(--duration-fast) var(--easing-standard),
          box-shadow var(--duration-fast) var(--easing-standard);
      }

      &.is-active .el-radio-button__inner {
        background-color: var(--surface-card);
        color: var(--text-primary);
        box-shadow: var(--shadow-sm) !important;
        font-weight: 700;
      }
    }
  }

  .model-card {
    display: flex;
    gap: 10px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--surface-strong);
    padding: 10px;
  }

  .model-card-body {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .model-card-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .model-card-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-secondary);
  }

  .model-card-value {
    font-size: 14px;
    color: var(--text-primary);
    word-break: break-all;
  }

  .model-card-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-self: center;
  }

  .model-empty {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--text-secondary);
    font-size: 13px;
  }

  // TXT TOC rules
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
  .settings-content {
    .theme-mode-group {
      grid-template-columns: 1fr;
    }
  }
}

@media (max-width: 720px) {
  .settings-page {
    padding: 18px 18px 0;
  }
}
</style>
