<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { showMainTaskMessage } from '@/services/notification/mainTaskMessageService'

const version = ref<string>('')
const checking = ref(false)
const updateAvailable = ref(false)
const downloadProgress = ref(0)
const downloading = ref(false)
const updater = ref<any>(null)
const updateNotes = ref('')
const newVersion = ref('')
const statusType = ref<'success' | 'info' | 'warning' | 'error'>('info')
const statusTitle = ref('状态')
const statusMessage = ref('')

type ProxyPrepareResult = {
  enabled: boolean
  source: 'environment' | 'system' | 'none' | string
  proxy_url: string | null
}

onMounted(async () => {
  version.value = await getVersion()
  statusTitle.value = '更新检查'
  statusMessage.value = '可手动检查更新'
})

const toTaskErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return '发生未知异常'
}

async function applyProxy() {
  try {
    const proxyResult = await invoke<ProxyPrepareResult>('prepare_updater_proxy')
    if (proxyResult.enabled) {
      statusType.value = 'info'
      statusTitle.value = '代理提示'
      statusMessage.value = `已检测到代理并应用（来源: ${proxyResult.source}）`
    } else {
      statusType.value = 'info'
      statusTitle.value = '连接提示'
      statusMessage.value = '未检测到系统代理，使用直连方式'
    }
    return proxyResult
  } catch (proxyError) {
    console.warn('代理检测失败:', proxyError)
    statusType.value = 'warning'
    statusTitle.value = '代理失败'
    statusMessage.value = '代理检测失败，已切换为直连方式'
    return { enabled: false, source: 'none', proxy_url: null }
  }
}

async function checkForUpdates() {
  if (checking.value || downloading.value) return
  
  checking.value = true
  statusTitle.value = '正在检查'
  statusMessage.value = '正在准备网络环境...'
  
  // 检查更新前先尝试应用代理
  await applyProxy()
  
  try {
    const update = await check()
    
    if (update) {
      updateAvailable.value = true
      updater.value = update
      newVersion.value = update.version
      updateNotes.value = update.body || '无更新说明'
      statusType.value = 'success'
      statusTitle.value = '发现更新'
      statusMessage.value = `发现新版本 v${update.version}`
      showMainTaskMessage({
        type: 'success',
        title: '发现新版本',
        message: `检测到可用更新 v${update.version}。`,
        taskKey: 'app-update-check',
      })
    } else {
      updateAvailable.value = false
      statusType.value = 'info'
      statusTitle.value = '暂无更新'
      statusMessage.value = '当前已是最新版本'
      showMainTaskMessage({
        type: 'info',
        title: '当前已是最新版本',
        message: '未检测到新的应用更新。',
        taskKey: 'app-update-check',
      })
    }
  } catch (error) {
    console.error('检查更新失败:', error)
    statusType.value = 'error'
    statusTitle.value = '检查失败'
    statusMessage.value = toTaskErrorMessage(error)
    showMainTaskMessage({
      type: 'error',
      title: '检查更新失败',
      message: statusMessage.value,
      taskKey: 'app-update-check',
    })
  } finally {
    checking.value = false
  }
}

async function startUpdate() {
  if (!updater.value || downloading.value) return

  // 下载前再次确保代理已应用（虽然检查更新时可能已经应用过）
  await applyProxy()
  
  downloading.value = true
  downloadProgress.value = 0
  
  try {
    let totalSize = 0
    let downloadedSize = 0
    await updater.value.downloadAndInstall((event: any) => {
      switch (event.event) {
        case 'Started':
          totalSize = event.data.contentLength || 0
          downloadedSize = 0
          statusTitle.value = '正在下载'
          statusMessage.value = '正在建立连接...'
          break
        case 'Progress':
          downloadedSize += event.data.chunkLength || 0
          if (totalSize > 0) {
            downloadProgress.value = Math.min(
              100,
              Math.round((downloadedSize / totalSize) * 100)
            )
          }
          break
        case 'Finished':
          downloadProgress.value = 100
          statusTitle.value = '下载完成'
          statusMessage.value = '正在安装更新...'
          break
      }
    })

    statusType.value = 'success'
    statusTitle.value = '更新成功'
    statusMessage.value = '更新安装成功，即将重启...'
    showMainTaskMessage({
      type: 'success',
      title: '更新安装成功',
      message: '应用即将重启以完成更新。',
      taskKey: 'app-update-install',
    })
    setTimeout(async () => {
      await relaunch()
    }, 1500)
    
  } catch (error) {
    console.error('更新失败:', error)
    statusType.value = 'error'
    statusTitle.value = '更新失败'
    statusMessage.value = toTaskErrorMessage(error)
    downloading.value = false
    showMainTaskMessage({
      type: 'error',
      title: '更新安装失败',
      message: statusMessage.value,
      taskKey: 'app-update-install',
    })
  }
}
</script>

<template>
  <div class="about-container">
    <div class="card about-card">
      <div class="app-info">
        <img src="/src-tauri/icons/reader.png" class="app-logo" alt="logo" />
        <h2>T-Reader</h2>
        <p class="version-text">当前版本: v{{ version }}</p>
        <el-alert
          class="status-alert"
          :type="statusType"
          :title="statusTitle"
          :description="statusMessage"
          :closable="false"
          show-icon
        />
      </div>

      <div class="update-section">
        <el-button 
          v-if="!updateAvailable" 
          type="primary" 
          :loading="checking" 
          @click="checkForUpdates"
        >
          检查更新
        </el-button>

        <div v-else class="update-info">
          <el-alert
            :title="`新版本 v${newVersion} 可用`"
            type="success"
            :description="updateNotes"
            show-icon
            :closable="false"
          />
          
          <div v-if="downloading" class="progress-box">
             <span>正在下载更新...</span>
             <el-progress :percentage="downloadProgress" />
          </div>

          <el-button 
            v-if="!downloading" 
            type="success" 
            @click="startUpdate"
            class="update-btn"
          >
            立即更新
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.about-container {
  padding: 32px;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background-color: var(--el-bg-color-page);
  
  .about-card {
    background: var(--el-bg-color);
    border-radius: 12px;
    padding: 40px;
    width: 100%;
    max-width: 500px;
    box-shadow: var(--el-box-shadow-light);
    text-align: center;
  }

  .app-info {
    margin-bottom: 30px;
    
    .app-logo {
      width: 80px;
      height: 80px;
      border-radius: 16px;
      margin-bottom: 16px;
    }
    
    h2 {
      margin: 0;
      font-size: 24px;
      color: var(--el-text-color-primary);
    }
    
    .version-text {
      color: var(--el-text-color-secondary);
      margin-top: 8px;
    }

    .status-alert {
      margin-top: 14px;
      text-align: left;
      max-height: 200px;
      overflow-y: auto;
      
      :deep(.el-alert__description) {
        word-break: break-all;
        white-space: pre-wrap;
      }
    }
  }

  .update-section {
    border-top: 1px solid var(--el-border-color-lighter);
    padding-top: 24px;
    
    .update-info {
      text-align: left;
      
      .update-btn {
        margin-top: 20px;
        width: 100%;
      }
      
      .progress-box {
        margin-top: 20px;
        span {
          display: block;
          margin-bottom: 8px;
          color: var(--el-text-color-regular);
          font-size: 14px;
        }
      }
    }
  }
}
</style>
