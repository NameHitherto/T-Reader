<template>
  <!-- AI大模型 -->
  <section class="setting-group">
    <div class="setting-card">
      <template v-if="!isEditingModel">
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
              <span class="model-card-value">{{ currentProviderRequestUrl }}</span>
            </div>
          </div>
          <div class="model-card-actions">
            <el-button size="small" @click="startEditModel">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteModelProvider">删除</el-button>
          </div>
        </div>

        <div v-else class="model-empty">
          <span>暂无{{ purposeLabel }}模型配置</span>
          <el-button type="primary" size="small" @click="startAddModel">添加</el-button>
        </div>
      </template>

      <!-- Edit state -->
      <ModelProviderForm
        v-else
        :provider="editingProvider"
        :readonly-purpose="!isAddingModel"
        @submit="handleModelFormSubmit"
        @cancel="handleModelFormCancel"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import ModelProviderForm from '@/components/SettingTabs/ModelProviderForm.vue'
import { useSettingsCenter } from '@/composables/useSettingsCenter'

const {
  activePurpose,
  isEditingModel,
  isAddingModel,
  editingProvider,
  currentProvider,
  currentProviderRequestUrl,
  purposeLabel,
  startEditModel,
  startAddModel,
  handleModelFormSubmit,
  handleModelFormCancel,
  deleteModelProvider,
} = useSettingsCenter()
</script>

<style scoped lang="scss">
@use './setting-tab';

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
</style>
