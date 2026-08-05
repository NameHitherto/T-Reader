<template>
  <div class="model-provider-form">
    <div class="setting-item setting-item--select">
      <div class="setting-item__info">
        <span class="setting-item__title">模型类型</span>
      </div>
      <div class="setting-item__control">
        <el-select
          :model-value="form.purpose"
          :disabled="readonlyPurpose"
          @update:model-value="onPurposeChange"
        >
          <el-option v-for="p in purposes" :key="p.value" :label="p.label" :value="p.value" />
        </el-select>
      </div>
    </div>

    <div class="setting-item setting-item--input">
      <div class="setting-item__info">
        <span class="setting-item__title">API请求地址</span>
      </div>
      <div class="setting-item__control">
        <el-input v-model="form.baseUrl" placeholder="https://api.example.com" />
      </div>
    </div>

    <div class="setting-item setting-item--select">
      <div class="setting-item__info">
        <span class="setting-item__title">模型协议格式</span>
      </div>
      <div class="setting-item__control">
        <el-select :model-value="form.providerType" @update:model-value="onProviderTypeChange">
          <el-option v-for="p in providerTypes" :key="p" :label="p" :value="p" />
        </el-select>
      </div>
    </div>

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
          :model-value="form.endpoint"
          @update:model-value="form.endpoint = $event"
        >
          <el-option v-for="ep in endpointPresets" :key="ep" :label="ep" :value="ep" />
        </el-select>
        <el-input v-else v-model="form.endpoint" placeholder="/v1/chat/completions" />
      </div>
    </div>

    <div class="setting-item setting-item--input">
      <div class="setting-item__info">
        <span class="setting-item__title">模型名</span>
        <span class="setting-item__subtitle">实际请求模型ID</span>
      </div>
      <div class="setting-item__control">
        <el-input v-model="form.modelId" placeholder="gpt-4o" />
      </div>
    </div>

    <div class="setting-item setting-item--input">
      <div class="setting-item__info">
        <span class="setting-item__title">API Key</span>
      </div>
      <div class="setting-item__control">
        <el-input v-model="form.apiKey" type="password" show-password placeholder="sk-..." />
      </div>
    </div>

    <div class="model-provider-form__actions">
      <el-button type="primary" size="small" @click="onSubmit">注册</el-button>
      <el-button size="small" @click="$emit('cancel')">返回</el-button>
    </div>
  </div>
</template>

<script>
import { MODEL_PURPOSES, PURPOSE_LABELS, ENDPOINT_PRESETS, PROVIDER_TYPES } from '@/types/model'

export default {
  name: 'ModelProviderForm',
  props: {
    provider: {
      type: Object,
      default: null,
    },
    readonlyPurpose: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['submit', 'cancel'],
  data() {
    return {
      form: {
        purpose: this.provider?.purpose ?? 'chat',
        providerType: this.provider?.providerType ?? 'OpenAI',
        baseUrl: this.provider?.baseUrl ?? '',
        endpoint: this.provider?.endpoint ?? '',
        modelId: this.provider?.modelId ?? '',
        apiKey: this.provider?.apiKey ?? '',
      },
    }
  },
  computed: {
    purposes() {
      return MODEL_PURPOSES.map((p) => ({
        value: p,
        label: PURPOSE_LABELS[p],
      }))
    },
    providerTypes() {
      return PROVIDER_TYPES
    },
    endpointPresets() {
      const presets = ENDPOINT_PRESETS[this.form.providerType]
      if (!presets) return []
      return presets[this.form.purpose] ?? []
    },
    usesEndpointSelect() {
      return this.form.providerType !== 'Other' && this.endpointPresets.length > 0
    },
  },
  methods: {
    onPurposeChange(value) {
      this.form.purpose = value
      this.applyDefaultEndpoint()
    },
    onProviderTypeChange(value) {
      this.form.providerType = value
      this.applyDefaultEndpoint()
    },
    applyDefaultEndpoint() {
      const presets = this.endpointPresets
      if (presets.length > 0 && !presets.includes(this.form.endpoint)) {
        this.form.endpoint = presets[0]
      } else if (presets.length === 0) {
        this.form.endpoint = ''
      }
    },
    onSubmit() {
      this.$emit('submit', { ...this.form })
    },
  },
}
</script>

<style scoped lang="scss">
.model-provider-form {
  // 与 SettingsView 中 setting-item 视觉对齐：
  // --select：标题在左、控件在右；--input：标题在上、控件占满宽度
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

    &__control {
      :deep(.el-select) {
        width: 100%;
      }
    }

    // 输入型：标题在上、控件占满卡片宽度
    &--input {
      display: block;

      .setting-item__info {
        margin-bottom: 10px;
      }

      .setting-item__control {
        width: 100%;
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
      }
    }
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 14px 0 10px;
  }
}
</style>
