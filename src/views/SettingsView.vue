<template>
  <div class="settings-page">
    <div class="settings-page-scroll">
      <div class="settings-content">
        <div class="dialog-content">
          <!-- 界面主题 -->
          <section class="setting-group">
            <h3 class="setting-group__title">界面主题</h3>
            <div class="setting-card">
              <div class="setting-item">
                <div class="setting-item__info">
                  <span class="setting-item__title">黑夜模式</span>
                  <span class="setting-item__subtitle">开启后切换为深色视觉主题</span>
                </div>
                <el-switch
                  :model-value="themeMode === 'dark'"
                  class="theme-switch"
                  :aria-label="themeMode === 'dark' ? '切换到白天模式' : '切换到黑夜模式'"
                  @change="onThemeSwitchChange"
                >
                  <template #active-action>
                    <AppIcon name="moon" :size="14" />
                  </template>
                  <template #inactive-action>
                    <AppIcon name="sun" :size="14" />
                  </template>
                </el-switch>
              </div>
            </div>
          </section>

          <!-- 云同步 -->
          <section class="setting-group">
            <h3 class="setting-group__title">云同步</h3>
            <div class="setting-card">
              <div class="setting-item setting-item--select">
                <div class="setting-item__info">
                  <span class="setting-item__title">云同步平台</span>
                  <span class="setting-item__subtitle">选择 WebDAV 服务商</span>
                </div>
                <div class="setting-item__control">
                  <el-select v-model="webdavProvider" placeholder="请选择">
                    <el-option
                      v-for="item in platformList"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </div>
              </div>
              <div
                v-if="webdavProvider === 'custom'"
                class="setting-item setting-item--input"
              >
                <div class="setting-item__info">
                  <span class="setting-item__title">服务器地址</span>
                  <span class="setting-item__subtitle">WebDAV 地址</span>
                </div>
                <div class="setting-item__control">
                  <el-input
                    v-model="webdavUrlRoot"
                    placeholder="https://example.com/dav/"
                  />
                </div>
              </div>
              <div class="setting-item setting-item--input">
                <div class="setting-item__info">
                  <span class="setting-item__title">文件目录</span>
                  <span class="setting-item__subtitle">云同步的根目录</span>
                </div>
                <div class="setting-item__control">
                  <el-input v-model="webdavUrlFolder" placeholder="请输入云同步的目录">
                    <template #prepend>({{ webdavUrlRoot }})</template>
                  </el-input>
                </div>
              </div>
              <div class="setting-item setting-item--input">
                <div class="setting-item__info">
                  <span class="setting-item__title">用户名</span>
                  <span class="setting-item__subtitle">WebDAV 账号用户名</span>
                </div>
                <div class="setting-item__control">
                  <el-input v-model="webdavUsername" placeholder="请输入用户名" />
                </div>
              </div>
              <div class="setting-item setting-item--input">
                <div class="setting-item__info">
                  <span class="setting-item__title">密码</span>
                  <span class="setting-item__subtitle">应用密码（授权码）</span>
                </div>
                <div class="setting-item__control">
                  <el-input
                    v-model="webdavPassword"
                    type="password"
                    placeholder="请输入密码"
                    show-password
                  />
                </div>
              </div>
              <div class="setting-item setting-item--input">
                <div class="setting-item__info">
                  <span class="setting-item__title">请求超时限制（秒）</span>
                </div>
                <div class="setting-item__control">
                  <el-input-number
                    v-model="webdavTimeoutSeconds"
                    :min="1"
                    :max="300"
                    :step="5"
                    controls-position="right"
                  />
                </div>
              </div>
            </div>
          </section>

          <!-- AI大模型 -->
          <section class="setting-group">
            <h3 class="setting-group__title">AI大模型</h3>
            <div class="setting-card">
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
                  <span>暂无{{ purposeLabel }}模型配置</span>
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
            </div>
          </section>

          <!-- TXT分章规则 -->
          <section class="setting-group">
            <h3 class="setting-group__title">TXT分章规则</h3>
            <div class="setting-card">
              <div v-if="txtTocRules.length === 0" class="txt-toc-rule-empty">暂无可展示规则</div>
              <div v-else class="txt-toc-rule-list">
                <article
                  v-for="(rule, index) in txtTocRules"
                  :key="rule.id"
                  class="setting-item txt-toc-rule"
                >
                  <div class="txt-toc-rule__priority">
                    <button
                      type="button"
                      class="txt-toc-rule__order-btn"
                      title="上移优先级"
                      :disabled="index === 0"
                      @click="moveRule(index, -1)"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      class="txt-toc-rule__order-btn"
                      title="下移优先级"
                      :disabled="index === txtTocRules.length - 1"
                      @click="moveRule(index, 1)"
                    >
                      ↓
                    </button>
                  </div>

                  <div class="txt-toc-rule__content">
                    <div class="txt-toc-rule__header">
                      <span class="txt-toc-rule__name">{{ rule.name }}</span>
                      <el-switch v-model="rule.enable" size="small" />
                    </div>
                    <div class="txt-toc-rule__field">
                      <span class="txt-toc-rule__label">样例</span>
                      <p class="txt-toc-rule__example">{{ rule.example }}</p>
                    </div>
                    <div class="txt-toc-rule__field">
                      <span class="txt-toc-rule__label">规则</span>
                      <pre class="txt-toc-rule__regex">{{ rule.rule }}</pre>
                    </div>
                  </div>
                </article>
              </div>
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
import AppIcon from '@/components/common/AppIcon/index.vue'
import { logWarn } from '@/utils/logger'

const AUTO_SAVE_DELAY_MS = 200

export default {
  name: 'SettingsView',
  components: { ModelProviderForm, AppIcon },
  data() {
    return {
      settings: {},
      themeMode: 'light',
      webdavProvider: 'custom',
      webdavUrlRoot: '',
      presetWebdavRoot: 'https://dav.jianguoyun.com/dav/',
      webdavUrlFolder: '',
      webdavUsername: '',
      webdavPassword: '',
      webdavTimeoutSeconds: 30,
      platformList: [
        { value: 'preset', label: '坚果云' },
        { value: 'custom', label: '自定义服务器' },
      ],
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
    webdavProvider(newValue) {
      if (newValue === 'preset') {
        this.webdavUrlRoot = this.presetWebdavRoot
      }
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
    webdavTimeoutSeconds() {
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
        this.webdavProvider =
          loadedSettings.webdavUrlRoot === this.presetWebdavRoot ? 'preset' : 'custom'
        this.webdavUrlRoot = loadedSettings.webdavUrlRoot
        this.webdavUrlFolder = loadedSettings.webdavUrlFolder
        this.webdavUsername = loadedSettings.webdavUser
        this.webdavPassword = loadedSettings.webdavPass
        this.webdavTimeoutSeconds = loadedSettings.webdavTimeoutSeconds ?? 30
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
        webdavTimeoutSeconds: this.webdavTimeoutSeconds,
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
    onThemeSwitchChange(value) {
      this.themeMode = value ? 'dark' : 'light'
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
    gap: 20px;
    padding: 0 4px 24px 0;
  }

  // Group：独立标题 + 通栏卡片
  .setting-group__title {
    margin: 0 0 10px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .setting-card {
    padding: 0 16px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-card);
    box-shadow: var(--shadow-xs);
  }

  // Item：左侧信息 + 右侧控件
  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 0;

    &:not(:last-child) {
      border-bottom: 1px solid var(--border-soft);
    }

    &__info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    &__title {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
    }

    &__subtitle {
      font-size: 12px;
      line-height: 1.5;
      color: var(--text-tertiary);
    }

    // 输入型：标题在上、控件占满卡片宽度
    &--input {
      display: block;

      .setting-item__info {
        margin-bottom: 10px;
      }

      .setting-item__control {
        width: 100%;

        :deep(.el-select) {
          width: 100%;
        }
      }
    }

    // 选择型：标题在左、控件在右
    &--select {
      flex-direction: row;

      .setting-item__info {
        flex: 1;
      }

      .setting-item__control {
        flex-shrink: 0;
        min-width: 160px;

        :deep(.el-select) {
          width: 100%;
        }
      }
    }
  }

  // 主题 Switch（基于 el-switch，带日/月图标）
  .theme-switch {
    --el-switch-on-color: var(--brand-primary);
    --el-switch-off-color: var(--surface-inset);
    flex-shrink: 0;

    :deep(.el-switch__core) {
      min-width: 48px;
      height: 26px;
      border-radius: var(--radius-pill);
    }

    :deep(.el-switch__action) {
      width: 22px;
      height: 22px;
      background: #ffffff;
      color: var(--brand-secondary);
      box-shadow: var(--shadow-sm);
    }

    &.is-checked :deep(.el-switch__action) {
      left: calc(100% - 23px);
      color: var(--brand-primary);
    }
  }

  // AI 模型
  .purpose-tabs {
    padding: 14px 0 12px;
    border-bottom: 1px solid var(--border-soft);

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
    align-items: center;
    gap: 12px;
    padding: 14px 0;
  }

  .model-card-body {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .model-card-field {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }

  .model-card-label {
    flex-shrink: 0;
    width: 64px;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-tertiary);
  }

  .model-card-value {
    font-size: 13px;
    color: var(--text-primary);
    word-break: break-all;
  }

  .model-card-actions {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;

    :deep(.el-button + .el-button) {
      // 垂直排列时水平间距由容器 gap 控制，抵消全局相邻按钮 margin
      margin-left: 0;
    }
  }

  .model-empty {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 0;
    color: var(--text-secondary);
    font-size: 13px;
  }

  // TXT 分章规则
  .txt-toc-rule-empty {
    padding: 14px 0;
    color: var(--text-tertiary);
    font-size: 13px;
  }

  .txt-toc-rule-list {
    display: flex;
    flex-direction: column;
  }

  .txt-toc-rule {
    align-items: flex-start;
    justify-content: flex-start;

    &__priority {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: 2px;
    }

    &__order-btn {
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

    &__content {
      min-width: 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    &__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    &__name {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
    }

    &__field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    &__label {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-tertiary);
    }

    &__example {
      margin: 0;
      font-size: 12px;
      color: var(--text-tertiary);
      word-break: break-word;
    }

    &__regex {
      margin: 0;
      padding: 8px 10px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-soft);
      background: var(--surface-card-soft);
      color: var(--text-primary);
      font-size: 12px;
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-all;
    }
  }
}

@media (max-width: 720px) {
  .settings-page {
    padding: 18px 18px 0;
  }
}
</style>
