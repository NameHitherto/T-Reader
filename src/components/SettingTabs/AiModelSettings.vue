<template>
  <!-- AI大模型 -->
  <section class="setting-group">
    <div class="setting-card">
      <!-- 模型类型：四个交互式单选按钮 -->
      <div class="setting-item setting-item--input">
        <div class="setting-item__info">
          <span class="setting-item__title">模型类型</span>
        </div>
        <div class="setting-item__control">
          <div class="purpose-selector" role="radiogroup" aria-label="模型类型">
            <button
              v-for="p in purposes"
              :key="p.value"
              type="button"
              class="purpose-option"
              :class="{ 'is-active': activePurpose === p.value }"
              role="radio"
              :aria-checked="activePurpose === p.value"
              @click="onPurposeChange(p.value)"
            >
              {{ p.label }}
            </button>
          </div>
        </div>
      </div>

      <template v-if="currentProvider">
        <!-- API请求地址 -->
        <div class="setting-item setting-item--input">
          <div class="setting-item__info">
            <div class="setting-item__title-row">
              <span class="setting-item__title">API请求地址</span>
              <div class="full-url-switch" :class="{ 'is-active': currentProvider.fullUrl }">
                <AppIcon
                  class="full-url-switch__icon"
                  name="fullUrl"
                  :size="13"
                  aria-label="完整URL"
                />
                <span class="full-url-switch__label">完整URL</span>
                <el-switch v-model="currentProvider.fullUrl" size="small" aria-label="完整URL" />
              </div>
            </div>
          </div>
          <div class="setting-item__control">
            <el-input
              v-model="currentProvider.baseUrl"
              :placeholder="
                currentProvider.fullUrl
                  ? 'https://api.example.com/v1/chat/completions'
                  : 'https://api.example.com'
              "
            />
          </div>
        </div>

        <!-- 模型协议格式 -->
        <div class="setting-item setting-item--select">
          <div class="setting-item__info">
            <span class="setting-item__title">模型协议格式</span>
          </div>
          <div class="setting-item__control">
            <el-select
              :model-value="currentProvider.providerType"
              :disabled="currentProvider.fullUrl"
              @update:model-value="onProviderTypeChange"
            >
              <el-option v-for="p in providerTypes" :key="p" :label="p" :value="p" />
            </el-select>
          </div>
        </div>

        <!-- 端点映射 -->
        <div
          class="setting-item"
          :class="usesEndpointSelect ? 'setting-item--select' : 'setting-item--input'"
        >
          <div class="setting-item__info">
            <span class="setting-item__title">端点映射</span>
          </div>
          <div class="setting-item__control">
            <el-select
              v-if="usesEndpointSelect"
              :model-value="currentProvider.endpoint"
              :disabled="currentProvider.fullUrl"
              @update:model-value="onEndpointChange"
            >
              <el-option v-for="ep in endpointPresets" :key="ep" :label="ep" :value="ep" />
            </el-select>
            <el-input
              v-else
              v-model="currentProvider.endpoint"
              :disabled="currentProvider.fullUrl"
              placeholder="/v1/chat/completions"
            />
          </div>
        </div>

        <!-- 模型名 -->
        <div class="setting-item setting-item--input">
          <div class="setting-item__info">
            <span class="setting-item__title">模型名</span>
            <span class="setting-item__subtitle">实际请求模型ID</span>
          </div>
          <div class="setting-item__control">
            <el-input v-model="currentProvider.modelId" placeholder="gpt-4o" />
          </div>
        </div>

        <!-- API Key -->
        <div class="setting-item setting-item--input">
          <div class="setting-item__info">
            <span class="setting-item__title">API Key</span>
          </div>
          <div class="setting-item__control">
            <el-input
              v-model="currentProvider.apiKey"
              type="password"
              show-password
              placeholder="sk-..."
            />
          </div>
        </div>

        <!-- 对话专用 -->
        <div v-if="activePurpose === 'chat'" class="setting-item setting-item--input">
          <div class="setting-item__info">
            <span class="setting-item__title">上下文窗口</span>
            <span class="setting-item__subtitle">模型支持的最大上下文 Token 数，留空则默认 100K</span>
          </div>
          <div class="setting-item__control context-window-control">
            <el-input-number
              v-model="currentProvider.contextWindowSize"
              :min="1"
              :max="100000000"
              :step="1024"
              controls-position="right"
              placeholder="默认 100K"
            />
            <div class="context-window-presets">
              <el-tag
                v-for="preset in contextWindowPresets"
                :key="preset.label"
                :effect="currentProvider.contextWindowSize === preset.value ? 'dark' : 'plain'"
                class="context-window-preset"
                @click="applyContextWindowPreset(preset.value)"
              >
                {{ preset.label }}
              </el-tag>
            </div>
          </div>
        </div>

        <!-- 嵌入专用 -->
        <div v-if="activePurpose === 'embedding'" class="setting-item setting-item--input">
          <div class="setting-item__info">
            <span class="setting-item__title">批次大小</span>
            <span class="setting-item__subtitle">每次嵌入请求最多包含的文本块数量</span>
          </div>
          <div class="setting-item__control">
            <el-input-number
              v-model="currentProvider.batchSize"
              :min="1"
              :max="100"
              :step="1"
              controls-position="right"
            />
          </div>
        </div>

        <div v-if="activePurpose === 'embedding'" class="setting-item setting-item--input">
          <div class="setting-item__info">
            <span class="setting-item__title">向量维度</span>
            <span class="setting-item__subtitle">用于校验嵌入结果，留空则自动识别</span>
          </div>
          <div class="setting-item__control">
            <el-input-number
              v-model="currentProvider.vectorDimension"
              :min="1"
              :max="100000"
              :step="1"
              controls-position="right"
              placeholder="自动识别"
            />
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/components/common/AppIcon/index.vue'
import { useSettingsCenter } from '@/composables/useSettingsCenter'
import {
  ENDPOINT_PRESETS,
  MODEL_PURPOSES,
  PURPOSE_LABELS,
  PROVIDER_TYPES,
  type ModelPurpose,
  type ProviderType,
} from '@/types/model'

const { activePurpose, currentProvider, ensureProvider, selectModelPurpose } =
  useSettingsCenter()

// 首次渲染即确保当前模型类型持有可编辑对象，避免表单字段无绑定目标
ensureProvider(activePurpose.value)

const purposes = MODEL_PURPOSES.map((p) => ({
  value: p,
  label: PURPOSE_LABELS[p],
}))

const providerTypes = PROVIDER_TYPES

// 上下文窗口常用预设（K = 1024，M = 1024K）
const contextWindowPresets = [
  { label: '100K', value: 100 * 1024 },
  { label: '256K', value: 256 * 1024 },
  { label: '512K', value: 512 * 1024 },
  { label: '1M', value: 1024 * 1024 },
]

const applyContextWindowPreset = (value: number) => {
  const provider = currentProvider.value
  if (!provider) return
  provider.contextWindowSize = value
}

const endpointPresets = computed(() => {
  const providerType = currentProvider.value?.providerType ?? 'Other'
  const presets = ENDPOINT_PRESETS[providerType]
  if (!presets) return []
  return presets[activePurpose.value] ?? []
})

const usesEndpointSelect = computed(() => {
  const providerType = currentProvider.value?.providerType ?? 'Other'

  return providerType !== 'Other' && endpointPresets.value.length > 0
})

const onPurposeChange = (purpose: ModelPurpose) => {
  selectModelPurpose(purpose)
}

const onProviderTypeChange = (value: unknown) => {
  const provider = currentProvider.value
  if (!provider || typeof value !== 'string') return
  provider.providerType = value as ProviderType
  applyDefaultEndpoint()
}

const onEndpointChange = (value: unknown) => {
  const provider = currentProvider.value
  if (!provider || typeof value !== 'string') return
  provider.endpoint = value
}

const applyDefaultEndpoint = () => {
  const provider = currentProvider.value
  if (!provider) return
  const presets = endpointPresets.value
  if (presets.length > 0 && !presets.includes(provider.endpoint)) {
    provider.endpoint = presets[0]
  } else if (presets.length === 0) {
    provider.endpoint = ''
  }
}
</script>

<style scoped lang="scss">
@use './setting-tab';

// 模型类型单选按钮组：标题下方横向排布，选中 / 悬浮仅过渡背景、文字颜色与边框
.purpose-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.purpose-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--easing-standard),
    background-color var(--duration-fast) var(--easing-standard),
    border-color var(--duration-fast) var(--easing-standard);

  &:hover {
    color: var(--brand-primary);
    background: var(--surface-brand-soft);
    border-color: var(--border-brand);
  }

  &.is-active {
    color: var(--brand-primary);
    background: var(--surface-brand-soft);
    border-color: var(--border-brand);
    font-weight: 700;
  }
}

// 上下文窗口：数字输入框 + 右侧常用值预设 Tag
.context-window-control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.context-window-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.context-window-preset {
  cursor: pointer;
  user-select: none;
}

// API 请求地址标题行（标题 + 完整 URL 开关）
.setting-item__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.full-url-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 4px 8px 4px 7px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: var(--surface-inset);
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  transition:
    color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;

  &.is-active {
    background: var(--brand-primary-tint-7);
    color: var(--brand-primary);
    box-shadow: var(--shadow-sm);
  }

  &__icon {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
  }

  &__label {
    white-space: nowrap;
  }

  :deep(.el-switch) {
    --el-switch-on-color: var(--brand-primary);
    --el-switch-off-color: var(--text-tertiary);
  }
}
</style>