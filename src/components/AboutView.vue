<script setup lang="ts">
import { getVersion } from '@tauri-apps/api/app'
import { Channel, invoke } from '@tauri-apps/api/core'
import { computed, onMounted, ref } from 'vue'
import { showMainTaskMessage } from '@/services/notification/mainTaskMessageService'
import type { AppUpdateCheckResult, AppUpdateProgressEvent } from '@/types/appUpdate'

const version = ref('')
const checking = ref(false)
const installing = ref(false)
const checkResult = ref<AppUpdateCheckResult | null>(null)
const currentProgress = ref<AppUpdateProgressEvent | null>(null)

const toTaskErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return '发生未知错误'
}

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
    const result = await invoke<AppUpdateCheckResult>('check_app_update')
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
      message: toTaskErrorMessage(error),
      taskKey: 'app-update-check',
    })
  } finally {
    checking.value = false
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
      message: toTaskErrorMessage(error),
      taskKey: 'app-update-install',
    })
  } finally {
    installing.value = false
  }
}

onMounted(async () => {
  version.value = await getVersion()
})
</script>

<template>
  <div class="about-container">
    <section class="surface-card surface-card--strong hero-card">
      <div class="hero-main">
        <img src="/src-tauri/icons/reader.png" class="app-logo" alt="T-Reader logo" />
        <div class="hero-copy">
          <h2>更新中心</h2>
          <p class="hero-subtitle">当前版本：<strong>v{{ version }}</strong></p>
          <p class="hero-meta">{{ statusText }}</p>
        </div>
      </div>

      <div class="hero-actions">
        <el-button type="primary" :loading="checking" @click="checkForUpdates">检查更新</el-button>
        <el-button type="success" :loading="installing" :disabled="!canStartInstall" @click="startUpdate">
          下载并安装
        </el-button>
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
      <p class="info-line"><strong>更新时间：</strong>{{ formatDateTime(currentProgress?.eventAt) }}</p>
      <el-progress :percentage="progressPercent" :stroke-width="12" />
      <p class="info-line"><strong>传输：</strong>{{ transferText }}</p>
      <p class="info-line"><strong>状态：</strong>{{ currentProgress?.message || '等待下载开始' }}</p>
    </section>
  </div>
</template>

<style scoped lang="scss">
.about-container {
  height: 100%;
  width: 100%;
  padding: 24px;
  overflow-y: auto;
  background:
    radial-gradient(circle at 12% 10%, var(--surface-brand-soft), transparent 32%),
    radial-gradient(circle at 82% 14%, var(--surface-warning-soft), transparent 28%),
    var(--app-bg-accent);
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
  margin: 6px 0 0;
  color: var(--text-secondary);
}

.hero-meta {
  margin: 6px 0 0;
  color: var(--text-tertiary);
  font-size: 13px;
}

.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
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
