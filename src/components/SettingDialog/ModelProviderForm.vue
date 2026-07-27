<template>
  <div class="model-provider-form">
    <div class="select-container">
      <label class="field-label">模型用途</label>
      <el-select
        :model-value="form.purpose"
        :disabled="readonlyPurpose"
        @update:model-value="onPurposeChange"
      >
        <el-option v-for="p in purposes" :key="p.value" :label="p.label" :value="p.value" />
      </el-select>
    </div>
    <div class="input-container">
      <label class="field-label">基础路径 (base_url)</label>
      <el-input v-model="form.baseUrl" />
    </div>
    <div class="input-container">
      <label class="field-label">服务商 (provider_type)</label>
      <el-select :model-value="form.providerType" @update:model-value="onProviderTypeChange">
        <el-option v-for="p in providerTypes" :key="p" :label="p" :value="p" />
      </el-select>
    </div>
    <div class="input-container">
      <label class="field-label">接口路径 (endpoint)</label>
      <el-select
        v-if="form.providerType !== 'Other' && endpointPresets.length > 0"
        :model-value="form.endpoint"
        @update:model-value="form.endpoint = $event"
      >
        <el-option v-for="ep in endpointPresets" :key="ep" :label="ep" :value="ep" />
      </el-select>
      <el-input v-else v-model="form.endpoint" />
    </div>
    <div class="input-container">
      <label class="field-label">模型ID</label>
      <el-input v-model="form.modelId" />
    </div>
    <div class="input-container">
      <label class="field-label">API Key</label>
      <el-input v-model="form.apiKey" type="password" show-password />
    </div>
    <div class="button-group">
      <el-button type="primary" @click="onSubmit">注册</el-button>
      <el-button @click="$emit('cancel')">返回</el-button>
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
  .input-container,
  .select-container {
    margin-top: 12px;
  }

  .field-label {
    display: inline-flex;
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--text-secondary);
    font-weight: 700;
  }

  .button-group {
    display: flex;
    gap: 12px;
    margin-top: 16px;
  }
}
</style>
