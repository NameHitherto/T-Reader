<script setup lang="ts">
import { getVersion } from '@tauri-apps/api/app'
import { Channel, invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-shell'
import { computed, onMounted, ref } from 'vue'
import AppIcon from '@/components/common/AppIcon/index.vue'
import { about } from '@/constants/about'
import { showMainTaskMessage } from '@/services/notification/mainTaskMessageService'
import { toHttpResponseMessage } from '@/services/response/responseHandler'
import {
  loadAppSettings,
  normalizeUpdateChannel,
  saveAppSettings,
  type UpdateChannel,
} from '@/services/settings/appSettingsService'
import type { IconName } from '@/icons/registry'
import type { AppUpdateCheckResult, AppUpdateProgressEvent } from '@/types/appUpdate'

const version = ref('')
const checking = ref(false)
const installing = ref(false)
const savingChannel = ref(false)
const updateChannel = ref<UpdateChannel>('stable')
const persistedUpdateChannel = ref<UpdateChannel>('stable')
const checkResult = ref<AppUpdateCheckResult | null>(null)
const currentProgress = ref<AppUpdateProgressEvent | null>(null)

const formatDateTime = (timestamp: number | null | undefined): string => {
  if (!timestamp) {
    return '暂无'
  }

  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return '暂无'
  }
  return date.toLocaleString()
}

const formatBytes = (bytes: number | null | undefined): string => {
  if (!bytes || bytes <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  const rounded = value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)

  return `${rounded} ${units[index]}`
}

const stageToLabel = (stage: string | undefined): string => {
  const labels: Record<string, string> = {
    preparing: '准备中',
    downloading: '下载中',
    installing: '安装中',
    handoff: '安装接管',
    failed: '失败',
  }
  if (!stage) {
    return '待开始'
  }
  return labels[stage] ?? stage
}

const canStartInstall = computed(() => {
  const result = checkResult.value

  return Boolean(result?.hasUpdate && result.updateToken && !checking.value && !installing.value)
})

const showProgressTimeline = computed(() => {
  return Boolean(installing.value || currentProgress.value)
})

const showReleaseNotes = computed(() => {
  const hasUpdate = Boolean(checkResult.value?.hasUpdate)

  return hasUpdate && !showProgressTimeline.value
})

const isPreviewBuild = computed(() => {
  return /^\d+\.\d+\.\d+-[0-9A-Za-z-]/.test(version.value)
})

const channelOptions = [
  { label: '正式版', value: 'stable' },
  { label: '预览版', value: 'preview' },
]

const channelDescription = computed(() => {
  return updateChannel.value === 'preview'
    ? '接收正式版与抢先体验版本'
    : '仅接收正式发布版本'
})

interface ContactItem {
  key: string
  label: string
  value: string
  actionLabel: string
  target: string
  icon: IconName
  iconColor: string
}

const contactItems = computed<ContactItem[]>(() => [
  {
    key: 'bilibili',
    label: 'Bilibili',
    value: about.contact.bilibili,
    actionLabel: '打开主页',
    target: about.contact.bilibili,
    icon: 'contactBilibili',
    iconColor: '#00aeec',
  },
  {
    key: 'github',
    label: 'GitHub',
    value: about.contact.github,
    actionLabel: '打开主页',
    target: about.contact.github,
    icon: 'contactGithub',
    iconColor: '#24292f',
  },
  {
    key: 'email',
    label: '邮箱',
    value: about.contact.email,
    actionLabel: '发送邮件',
    target: `mailto:${about.contact.email}`,
    icon: 'contactEmail',
    iconColor: 'var(--brand-primary)',
  },
])

const progressPercent = computed(() => {
  const event = currentProgress.value
  if (!event || typeof event.percent !== 'number') {
    return 0
  }
  return Math.max(0, Math.min(100, Number(event.percent.toFixed(1))))
})

const transferText = computed(() => {
  const event = currentProgress.value
  if (!event) {
    return '暂无'
  }
  const downloaded = formatBytes(event.downloadedBytes)
  const total = event.totalBytes ? formatBytes(event.totalBytes) : '总大小未知'

  return `${downloaded} / ${total}`
})

const statusText = computed(() => {
  if (checking.value) {
    return '正在检查更新...'
  }
  if (installing.value) {
    return '正在下载安装更新...'
  }
  if (checkResult.value?.hasUpdate) {
    return `发现新版本 v${checkResult.value.latestVersion || '未知'}`
  }
  if (checkResult.value && !checkResult.value.error) {
    return `当前已是最新版本 v${checkResult.value.currentVersion}`
  }
  return '可手动检查更新'
})

const checkForUpdates = async () => {
  if (checking.value || installing.value) {
    return
  }

  checking.value = true
  currentProgress.value = null

  try {
    const result = await invoke<AppUpdateCheckResult>('check_app_update', {
      updateChannel: updateChannel.value,
    })
    checkResult.value = result

    if (result.error) {
      showMainTaskMessage({
        type: 'error',
        title: '检查更新失败',
        message: result.error,
        taskKey: 'app-update-check',
      })
      return
    }

    if (result.hasUpdate) {
      showMainTaskMessage({
        type: 'success',
        title: '发现可用更新',
        message: `检测到版本 v${result.latestVersion || '未知'}。`,
        taskKey: 'app-update-check',
      })
      return
    }

    showMainTaskMessage({
      type: 'info',
      title: '当前已是最新版本',
      message: `当前版本 ${result.currentVersion} 已是最新。`,
      taskKey: 'app-update-check',
    })
  } catch (error) {
    showMainTaskMessage({
      type: 'error',
      title: '检查更新失败',
      message: toHttpResponseMessage(error),
      taskKey: 'app-update-check',
    })
  } finally {
    checking.value = false
  }
}

const handleUpdateChannelChange = async (value: string | number | boolean | undefined) => {
  const nextChannel = normalizeUpdateChannel(value)
  const previousChannel = persistedUpdateChannel.value

  if (nextChannel === previousChannel) {
    return
  }

  savingChannel.value = true
  try {
    await saveAppSettings({ updateChannel: nextChannel })
    updateChannel.value = nextChannel
    persistedUpdateChannel.value = nextChannel
    checkResult.value = null
    currentProgress.value = null
  } catch (error) {
    updateChannel.value = previousChannel
    showMainTaskMessage({
      type: 'error',
      title: '更新渠道保存失败',
      message: toHttpResponseMessage(error),
      taskKey: 'app-update-channel',
    })
  } finally {
    savingChannel.value = false
  }
}

const startUpdate = async () => {
  const token = checkResult.value?.updateToken
  if (!token || installing.value) {
    return
  }

  installing.value = true
  currentProgress.value = null

  const onEvent = new Channel<AppUpdateProgressEvent>((event) => {
    currentProgress.value = event
    if (event.stage === 'handoff') {
      showMainTaskMessage({
        type: 'success',
        title: '安装器已启动',
        message: event.message,
        taskKey: 'app-update-install',
      })
    }
    if (event.stage === 'failed' && event.errorSummary) {
      showMainTaskMessage({
        type: 'error',
        title: '更新下载失败',
        message: event.errorSummary,
        taskKey: 'app-update-install',
      })
    }
  })

  try {
    await invoke('install_app_update', {
      updateToken: token,
      onEvent,
    })
  } catch (error) {
    showMainTaskMessage({
      type: 'error',
      title: '更新安装失败',
      message: toHttpResponseMessage(error),
      taskKey: 'app-update-install',
    })
  } finally {
    installing.value = false
  }
}

const openContactTarget = async (label: string, target: string) => {
  try {
    await open(target)
  } catch (error) {
    showMainTaskMessage({
      type: 'error',
      title: `打开${label}失败`,
      message: toHttpResponseMessage(error),
      taskKey: `about-contact-${label}`,
    })
  }
}

onMounted(async () => {
  const [currentVersion, settings] = await Promise.all([getVersion(), loadAppSettings()])
  version.value = currentVersion
  updateChannel.value = settings.updateChannel
  persistedUpdateChannel.value = settings.updateChannel
})
</script>

<template>
  <div class="about-container">
    <section class="surface-card surface-card--strong hero-card">
      <div class="hero-main">
        <img src="/src-tauri/icons/reader.png" class="app-logo" alt="T-Reader logo" />
        <div class="hero-copy">
          <h2>更新中心</h2>
          <div class="hero-subtitle">
            <span>当前版本：<strong>v{{ version }}</strong></span>
            <el-tag v-if="isPreviewBuild" type="warning" effect="dark" size="small">
              抢先体验
            </el-tag>
          </div>
          <p class="hero-meta">{{ statusText }}</p>
        </div>
      </div>

      <div class="channel-setting">
        <div class="channel-copy">
          <span class="channel-label">更新渠道</span>
          <span class="channel-description">{{ channelDescription }}</span>
        </div>
        <el-segmented
          v-model="updateChannel"
          :options="channelOptions"
          :disabled="checking || installing || savingChannel"
          @change="handleUpdateChannelChange"
        />
      </div>

      <div class="hero-actions">
        <el-button type="primary" :loading="checking" @click="checkForUpdates">检查更新</el-button>
        <el-button
          type="success"
          :loading="installing"
          :disabled="!canStartInstall"
          @click="startUpdate"
        >
          下载并安装
        </el-button>
      </div>
    </section>

    <section class="surface-card info-card contact-card">
      <div class="section-header">
        <h3>联系作者</h3>
        <p>如有问题请联系。</p>
      </div>

      <div class="contact-list">
        <div v-for="item in contactItems" :key="item.key" class="contact-item">
          <div class="contact-main">
            <span class="contact-icon" :style="{ color: item.iconColor }">
              <AppIcon :name="item.icon" :size="24" :aria-label="`${item.label} 图标`" />
            </span>
            <div class="contact-meta">
              <span class="contact-label">{{ item.label }}</span>
              <span class="contact-value">{{ item.value }}</span>
            </div>
          </div>
          <el-button type="primary" plain @click="openContactTarget(item.label, item.target)">
            {{ item.actionLabel }}
          </el-button>
        </div>
      </div>
    </section>

    <section v-if="showReleaseNotes" class="surface-card info-card">
      <h3>版本说明</h3>
      <p class="info-line"><strong>目标版本：</strong>{{ checkResult?.latestVersion || '暂无' }}</p>
      <div class="notes-box">{{ checkResult?.releaseNotes || '暂无版本说明。' }}</div>
    </section>

    <section v-if="showProgressTimeline" class="surface-card info-card">
      <h3>进度时间线</h3>
      <p class="info-line"><strong>阶段：</strong>{{ stageToLabel(currentProgress?.stage) }}</p>
      <p class="info-line">
        <strong>更新时间：</strong>{{ formatDateTime(currentProgress?.eventAt) }}
      </p>
      <el-progress :percentage="progressPercent" :stroke-width="12" />
      <p class="info-line"><strong>传输：</strong>{{ transferText }}</p>
      <p class="info-line">
        <strong>状态：</strong>{{ currentProgress?.message || '等待下载开始' }}
      </p>
    </section>
  </div>
</template>

<style scoped lang="scss">
.about-container {
  height: 100%;
  width: 100%;
  padding: 32px 24px;
  overflow-y: auto;
  color: var(--text-primary);
}

.hero-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  margin-bottom: 16px;
  border: 1px solid var(--border-brand);
}

.hero-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.app-logo {
  width: 68px;
  height: 68px;
  border-radius: 14px;
  box-shadow: var(--shadow-md);
}

.hero-copy {
  h2 {
    margin: 0;
    font-size: 24px;
    letter-spacing: 0.02em;
  }
}

.hero-subtitle {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
  color: var(--text-secondary);
}

.hero-meta {
  margin: 6px 0 0;
  color: var(--text-tertiary);
  font-size: 13px;
}

.contact-card {
  padding: 18px 20px;
  margin-bottom: 16px;
}

.section-header {
  margin-bottom: 14px;

  h3 {
    margin: 0;
    font-size: 16px;
  }

  p {
    margin: 6px 0 0;
    color: var(--text-tertiary);
    font-size: 13px;
  }
}

.contact-list {
  display: grid;
  gap: 10px;
}

.contact-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--surface-card-soft);
  transition:
    background-color var(--duration-fast) var(--easing-standard),
    border-color var(--duration-fast) var(--easing-standard),
    transform var(--duration-fast) var(--easing-standard);

  &:hover {
    transform: translateY(-1px);
    border-color: var(--border-brand);
    background: var(--surface-brand-soft);
  }

  :deep(.el-button) {
    flex: 0 0 auto;
  }
}

.contact-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.contact-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border: 1px solid rgb(15 23 42 / 12%);
  border-radius: var(--radius-sm);
  background: rgb(255 255 255 / 94%);
  box-shadow: var(--shadow-sm);
}

.contact-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.contact-label {
  color: var(--text-primary);
  font-weight: 600;
}

.contact-value {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.4;
  word-break: break-all;
}

@media (max-width: 640px) {
  .contact-item {
    align-items: stretch;
    flex-direction: column;

    :deep(.el-button) {
      width: 100%;
    }
  }
}

.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.channel-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 48px;
  padding: 10px 12px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--surface-card-soft);
}

.channel-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.channel-label {
  color: var(--text-primary);
  font-weight: 600;
}

.channel-description {
  color: var(--text-tertiary);
  font-size: 12px;
}

@media (max-width: 480px) {
  .channel-setting {
    align-items: stretch;
    flex-direction: column;
  }

  :deep(.el-segmented) {
    width: 100%;
  }
}

.info-card {
  padding: 18px;
  border: 1px solid var(--border-default);

  h3 {
    margin: 0 0 12px;
    font-size: 16px;
  }
}

.info-line {
  margin: 8px 0;
  line-height: 1.4;
  color: var(--text-secondary);
  word-break: break-all;
}

.notes-box {
  margin-top: 12px;
  padding: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-soft);
  background: var(--surface-card-soft);
  color: var(--text-secondary);
  white-space: pre-wrap;
  line-height: 1.5;
  max-height: 220px;
  overflow-y: auto;
}
</style>
