// 设置中心共享状态：SettingsView 与 SettingTabs 下各分类子标签页共用同一份
// 设置数据与自动保存逻辑（模块级单例），避免在视图与子标签之间层层传递 props。
import { computed, ref, watch } from 'vue'
import {
  loadAppSettings,
  saveAppSettings,
  type AppThemeMode,
} from '@/services/settings/appSettingsService'
import { detectSystemProxy } from '@/services/settings/proxyService'
import {
  loadTxtTocRules,
  resequenceTxtTocRules,
  saveTxtTocRules,
} from '@/services/book/txtTocRules'
import type { TxtTocRule } from '@/services/book/types'
import { emitAppThemeUpdate } from '@/services/theme/themeService'
import {
  ENDPOINT_PRESETS,
  type ModelProvider,
  type ModelPurpose,
  type ProviderType,
} from '@/types/model'
import type { SystemProxyInfo } from '@/types/proxy'
import { logWarn } from '@/utils/logger'

const AUTO_SAVE_DELAY_MS = 200
const PRESET_WEBDAV_ROOT = 'https://dav.jianguoyun.com/dav/'

export const WEBDAV_PLATFORM_OPTIONS = [
  { value: 'preset', label: '坚果云' },
  { value: 'custom', label: '自定义服务器' },
]

const themeMode = ref<AppThemeMode>('light')
const webdavProvider = ref<'preset' | 'custom'>('custom')
const webdavUrlRoot = ref('')
const webdavUrlFolder = ref('')
const webdavUsername = ref('')
const webdavPassword = ref('')
const webdavTimeoutSeconds = ref(30)
const proxyEnabled = ref(false)
const systemProxy = ref<SystemProxyInfo | null>(null)
const isDetectingProxy = ref(false)
const modelProviders = ref<Record<ModelPurpose, ModelProvider | null>>({
  chat: null,
  image: null,
  embedding: null,
  rerank: null,
})
const activePurpose = ref<ModelPurpose>('chat')
const txtTocRules = ref<TxtTocRule[]>([])

const isLoadingSettings = ref(false)
const hasLoadedSettings = ref(false)

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let lastSavedSnapshot = ''
let lastSavedThemeMode: AppThemeMode = 'light'

const webdavUrl = computed(() => {
  if (!webdavUrlFolder.value) {
    return ''
  }
  if (webdavUrlFolder.value.endsWith('/')) {
    return webdavUrlRoot.value + webdavUrlFolder.value
  }
  return webdavUrlRoot.value + webdavUrlFolder.value + '/'
})

const currentProvider = computed(() => modelProviders.value[activePurpose.value] ?? null)

// 为指定用途初始化一个默认模型配置，供编辑表单补建绑定目标并预填端点
const createDefaultProvider = (purpose: ModelPurpose): ModelProvider => {
  const providerType: ProviderType = 'OpenAI'
  const endpoint = ENDPOINT_PRESETS[providerType]?.[purpose]?.[0] ?? ''
  const provider: ModelProvider = {
    purpose,
    providerType,
    baseUrl: '',
    endpoint,
    fullUrl: false,
    modelId: '',
    apiKey: '',
  }
  if (purpose === 'embedding') {
    provider.batchSize = 20
    provider.vectorDimension = null
  }
  if (purpose === 'chat') {
    provider.contextWindowSize = null
  }
  return provider
}

// 确保指定用途存在可编辑配置对象，不存在时补建默认值，保证表单始终有绑定目标
const ensureProvider = (purpose: ModelPurpose): ModelProvider => {
  const existing = modelProviders.value[purpose]
  if (existing) {
    return existing
  }
  const next = createDefaultProvider(purpose)
  modelProviders.value = { ...modelProviders.value, [purpose]: next }
  return next
}

// 切换模型类型：先补建目标配置，再切换当前用途
const selectModelPurpose = (purpose: ModelPurpose) => {
  ensureProvider(purpose)
  activePurpose.value = purpose
}

const formattedProxyBypassList = computed(() => {
  const raw = systemProxy.value?.bypassList
  if (!raw) {
    return '无'
  }
  return raw
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter((item) => item && item !== '<local>')
    .join(', ')
})

const buildNextSettings = () => ({
  webdavUrlRoot: webdavUrlRoot.value,
  webdavUrlFolder: webdavUrlFolder.value,
  webdavUrl: webdavUrl.value,
  webdavUser: webdavUsername.value,
  webdavPass: webdavPassword.value,
  webdavTimeoutSeconds: webdavTimeoutSeconds.value,
  proxyEnabled: proxyEnabled.value,
  modelProviders: modelProviders.value,
  themeMode: themeMode.value,
})

const createSettingsSnapshot = () =>
  JSON.stringify({
    settings: buildNextSettings(),
    txtTocRules: txtTocRules.value,
  })

const clearAutoSaveTimer = () => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
}

const autoSaveSettings = async () => {
  if (!hasLoadedSettings.value) {
    return
  }

  const snapshot = createSettingsSnapshot()
  if (snapshot === lastSavedSnapshot) {
    return
  }

  const nextSettings = buildNextSettings()
  const shouldEmitThemeUpdate = themeMode.value !== lastSavedThemeMode

  try {
    await saveAppSettings(nextSettings)
    await saveTxtTocRules(txtTocRules.value)
    if (shouldEmitThemeUpdate) {
      await emitAppThemeUpdate(themeMode.value)
      lastSavedThemeMode = themeMode.value
    }
    lastSavedSnapshot = snapshot
  } catch (error) {
    logWarn('settings', 'auto-save-settings failed', error)
  }
}

const scheduleAutoSave = () => {
  if (isLoadingSettings.value || !hasLoadedSettings.value) {
    return
  }

  clearAutoSaveTimer()
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null
    void autoSaveSettings()
  }, AUTO_SAVE_DELAY_MS)
}

const flushAutoSaveSettings = async () => {
  clearAutoSaveTimer()
  await autoSaveSettings()
}

const refreshSystemProxy = async () => {
  isDetectingProxy.value = true
  try {
    systemProxy.value = await detectSystemProxy()
  } catch (error) {
    logWarn('settings', 'detect-system-proxy failed', error)
    systemProxy.value = null
  } finally {
    isDetectingProxy.value = false
  }
}

const loadSettings = async () => {
  if (hasLoadedSettings.value) {
    await flushAutoSaveSettings()
  }

  isLoadingSettings.value = true

  try {
    const loadedSettings = await loadAppSettings()
    themeMode.value = loadedSettings.themeMode
    webdavProvider.value = loadedSettings.webdavUrlRoot === PRESET_WEBDAV_ROOT ? 'preset' : 'custom'
    webdavUrlRoot.value = loadedSettings.webdavUrlRoot
    webdavUrlFolder.value = loadedSettings.webdavUrlFolder
    webdavUsername.value = loadedSettings.webdavUser
    webdavPassword.value = loadedSettings.webdavPass
    webdavTimeoutSeconds.value = loadedSettings.webdavTimeoutSeconds ?? 30
    proxyEnabled.value = loadedSettings.proxyEnabled === true
    modelProviders.value = { ...loadedSettings.modelProviders }
    ensureProvider(activePurpose.value)
    txtTocRules.value = await loadTxtTocRules()
    lastSavedThemeMode = loadedSettings.themeMode
    lastSavedSnapshot = createSettingsSnapshot()
    hasLoadedSettings.value = true
    if (proxyEnabled.value) {
      void refreshSystemProxy()
    }
  } catch (error) {
    logWarn('settings', 'load-settings failed', error)
  } finally {
    isLoadingSettings.value = false
  }
}

const moveTxtTocRule = (currentIndex: number, offset: number) => {
  const targetIndex = currentIndex + offset
  if (targetIndex < 0 || targetIndex >= txtTocRules.value.length) {
    return
  }

  const nextRules = [...txtTocRules.value]
  const currentRule = nextRules[currentIndex]
  nextRules[currentIndex] = nextRules[targetIndex]
  nextRules[targetIndex] = currentRule
  txtTocRules.value = resequenceTxtTocRules(nextRules)
}

// 任一可持久化字段变化均触发防抖自动保存
watch(
  [
    themeMode,
    webdavProvider,
    webdavUrlRoot,
    webdavUrlFolder,
    webdavUsername,
    webdavPassword,
    webdavTimeoutSeconds,
    modelProviders,
    txtTocRules,
  ],
  scheduleAutoSave,
  { deep: true },
)

watch(webdavProvider, (newValue) => {
  if (newValue === 'preset') {
    webdavUrlRoot.value = PRESET_WEBDAV_ROOT
  }
  scheduleAutoSave()
})

watch(proxyEnabled, (newValue) => {
  scheduleAutoSave()
  if (newValue) {
    void refreshSystemProxy()
  }
})

export function useSettingsCenter() {
  return {
    themeMode,
    webdavProvider,
    webdavUrlRoot,
    webdavUrlFolder,
    webdavUsername,
    webdavPassword,
    webdavTimeoutSeconds,
    webdavUrl,
    proxyEnabled,
    systemProxy,
    isDetectingProxy,
    formattedProxyBypassList,
    modelProviders,
    activePurpose,
    currentProvider,
    ensureProvider,
    selectModelPurpose,
    txtTocRules,
    loadSettings,
    flushAutoSaveSettings,
    refreshSystemProxy,
    moveTxtTocRule,
  }
}
