<template>
  <!-- 网络 -->
  <div class="network-settings">
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
                v-for="item in WEBDAV_PLATFORM_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </div>
        </div>
        <div v-if="webdavProvider === 'custom'" class="setting-item setting-item--input">
          <div class="setting-item__info">
            <span class="setting-item__title">服务器地址</span>
            <span class="setting-item__subtitle">WebDAV 地址</span>
          </div>
          <div class="setting-item__control">
            <el-input v-model="webdavUrlRoot" placeholder="https://example.com/dav/" />
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

    <!-- 网络代理 -->
    <section class="setting-group">
      <h3 class="setting-group__title">代理</h3>
      <div class="setting-card">
        <div class="setting-item">
          <div class="setting-item__info">
            <span class="setting-item__title">启用系统代理</span>
          </div>
          <el-switch v-model="proxyEnabled" aria-label="启用网络代理" />
        </div>
        <div v-if="proxyEnabled" class="proxy-detect">
          <div class="proxy-detect__header">
            <span class="proxy-detect__title">已检测到系统代理配置（只读）</span>
            <el-button size="small" text :loading="isDetectingProxy" @click="refreshSystemProxy">
              重新检测
            </el-button>
          </div>
          <template v-if="systemProxy && systemProxy.enabled">
            <div class="model-card-field">
              <span class="model-card-label">代理类型</span>
              <span class="model-card-value">{{ systemProxy.proxyType || '未知' }}</span>
            </div>
            <div class="model-card-field">
              <span class="model-card-label">服务器地址</span>
              <span class="model-card-value">{{ systemProxy.host || '未知' }}</span>
            </div>
            <div class="model-card-field">
              <span class="model-card-label">端口</span>
              <span class="model-card-value">{{ systemProxy.port ?? '未知' }}</span>
            </div>
            <div class="model-card-field">
              <span class="model-card-label">排除列表</span>
              <span class="model-card-value">{{ formattedProxyBypassList }}</span>
            </div>
          </template>
          <div v-else class="proxy-detect__empty">未检测到系统代理，网络请求将直连</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useSettingsCenter, WEBDAV_PLATFORM_OPTIONS } from '@/composables/useSettingsCenter'

const {
  webdavProvider,
  webdavUrlRoot,
  webdavUrlFolder,
  webdavUsername,
  webdavPassword,
  webdavTimeoutSeconds,
  proxyEnabled,
  systemProxy,
  isDetectingProxy,
  formattedProxyBypassList,
  refreshSystemProxy,
} = useSettingsCenter()
</script>

<style scoped lang="scss">
@use '@/styles/components/setting-tab';

.network-settings {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

// 网络代理检测结果（只读）
.proxy-detect {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 0 14px;
  border-top: 1px solid var(--border-soft);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 4px;
  }

  &__title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-tertiary);
  }

  &__empty {
    font-size: 13px;
    color: var(--text-tertiary);
  }
}
</style>
