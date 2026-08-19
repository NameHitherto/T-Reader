<template>
  <div class="update-settings">
    <!-- 应用信息 -->
    <div class="setting-card update-app-card">
      <span class="update-app-card__name">{{ about.app.name }}</span>
      <span class="update-app-card__slogan">{{ about.app.slogan }}</span>
      <div class="update-app-card__version">
        <span class="update-app-card__version-label">当前版本</span>
        <span class="update-app-card__version-value">v{{ version }}</span>
        <el-tag
          v-if="isPreviewBuild"
          type="warning"
          effect="dark"
          size="small"
          :disable-transitions="true"
        >
          抢先体验
        </el-tag>
      </div>
    </div>

    <!-- 软件更新 -->
    <div class="setting-card update-card">
      <div class="update-card__header">
        <span class="update-card__title">软件更新</span>
        <span class="update-card__subtitle">检查是否有新版本可用</span>
      </div>

      <div class="setting-item setting-item--select update-card__channel">
        <div class="setting-item__info">
          <span class="setting-item__title">更新渠道</span>
          <span class="setting-item__subtitle">{{ channelDescription }}</span>
        </div>
        <div class="setting-item__control">
          <el-select
            v-model="updateChannel"
            :disabled="checking || installing || savingChannel"
            @change="handleUpdateChannelChange"
          >
            <el-option
              v-for="option in channelOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </div>
      </div>

      <div
        v-if="statusKind !== 'idle'"
        class="update-status"
        :class="`update-status--${statusKind}`"
      >
        <AppIcon v-if="statusKind === 'latest'" name="checkCircle" :size="16" />
        <span>{{ statusText }}</span>
      </div>

      <div class="update-card__footer">
        <el-button
          class="update-primary-button"
          :loading="checking || installing"
          @click="onPrimaryAction"
        >
          <AppIcon name="refresh" :size="14" />
          <span>{{ primaryActionLabel }}</span>
        </el-button>
        <el-button class="update-website-button" text type="primary" @click="openOfficialWebsite">
          <AppIcon name="globe" :size="14" />
          <span>官方网站</span>
        </el-button>
      </div>
    </div>

    <div v-if="showReleaseNotes" class="setting-card update-info-card">
      <h4 class="update-info-card__title">版本说明</h4>
      <p class="update-info-card__line">
        <strong>目标版本：</strong>{{ checkResult?.latestVersion || '暂无' }}
      </p>
      <div class="update-notes-box">{{ checkResult?.releaseNotes || '暂无版本说明。' }}</div>
    </div>

    <div v-if="showProgressTimeline" class="setting-card update-info-card">
      <h4 class="update-info-card__title">进度时间线</h4>
      <p class="update-info-card__line">
        <strong>阶段：</strong>{{ stageToLabel(currentProgress?.stage) }}
      </p>
      <p class="update-info-card__line">
        <strong>更新时间：</strong>{{ formatDateTime(currentProgress?.eventAt) }}
      </p>
      <el-progress :percentage="progressPercent" :stroke-width="12" />
      <p class="update-info-card__line"><strong>传输：</strong>{{ transferText }}</p>
      <p class="update-info-card__line">
        <strong>状态：</strong>{{ currentProgress?.message || '等待下载开始' }}
      </p>
    </div>
  </div>
</template>

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
import type { AppUpdateCheckResult, AppUpdateProgressEvent } from '@/types/appUpdate'

const version = ref('')
const checking = ref(false)
const installing = ref(false)
const savingChannel = ref(false)
const updateChannel = ref<UpdateChannel>('stable')
const persistedUpdateChannel = ref<UpdateChannel>('stable')
const proxyEnabled = ref(false)
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
  return updateChannel.value === 'preview' ? '接收正式版与抢先体验版本' : '仅接收正式发布版本'
})

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

type UpdateStatusKind = 'idle' | 'busy' | 'update' | 'latest'

const statusKind = computed<UpdateStatusKind>(() => {
  if (checking.value || installing.value) {
    return 'busy'
  }
  if (checkResult.value?.hasUpdate) {
    return 'update'
  }
  if (checkResult.value && !checkResult.value.error) {
    return 'latest'
  }
  return 'idle'
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
    return `已是最新版本 v${checkResult.value.currentVersion}`
  }
  return ''
})

// 检查更新按钮：检测到新版本后变为下载更新
const primaryActionLabel = computed(() => (canStartInstall.value ? '下载更新' : '检查更新'))

const onPrimaryAction = () => {
  if (canStartInstall.value) {
    void startUpdate()
    return
  }
  void checkForUpdates()
}

const openOfficialWebsite = async () => {
  try {
    await open(about.app.website)
  } catch (error) {
    showMainTaskMessage({
      type: 'error',
      title: '打开官方网站失败',
      message: toHttpResponseMessage(error),
      taskKey: 'app-update-website',
    })
  }
}

const checkForUpdates = async () => {
  if (checking.value || installing.value) {
    return
  }

  checking.value = true
  currentProgress.value = null

  try {
    const result = await invoke<AppUpdateCheckResult>('check_app_update', {
      updateChannel: updateChannel.value,
      proxyEnabled: proxyEnabled.value,
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

onMounted(async () => {
  const [currentVersion, settings] = await Promise.all([getVersion(), loadAppSettings()])
  version.value = currentVersion
  updateChannel.value = settings.updateChannel
  persistedUpdateChannel.value = settings.updateChannel
  proxyEnabled.value = settings.proxyEnabled
})
</script>

<style scoped lang="scss">
@use './setting-tab';

.update-settings {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

// 应用信息卡片
.update-app-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px 16px;

  &__name {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
  }

  &__slogan {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  &__version {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 6px;
  }

  &__version-label {
    font-size: 13px;
    color: var(--text-tertiary);
  }

  &__version-value {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
  }
}

// 软件更新卡片
.update-card {
  display: flex;
  flex-direction: column;
  padding: 4px 16px 16px;

  &__header {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 0;
  }

  &__title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
  }

  &__subtitle {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  &__channel {
    border-top: 1px solid var(--border-soft);
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 14px;
  }
}

.update-primary-button,
.update-website-button {
  :deep(span) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
}

// 更新状态行
.update-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  font-size: 13px;
  color: var(--text-secondary);

  &--latest {
    color: var(--el-color-success);
  }

  &--update {
    color: var(--brand-primary);
    font-weight: 600;
  }
}

.update-info-card {
  &__title {
    margin: 14px 0 10px;
    font-size: 14px;
  }

  &__line {
    margin: 8px 0;
    color: var(--text-secondary);
    line-height: 1.4;
    word-break: break-all;
  }
}

.update-notes-box {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--surface-card-soft);
  color: var(--text-secondary);
  line-height: 1.5;
  white-space: pre-wrap;
  max-height: 220px;
  overflow-y: auto;
}
</style>
