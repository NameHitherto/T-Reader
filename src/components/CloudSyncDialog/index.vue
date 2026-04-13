<template>
  <el-dialog
    :model-value="modelValue"
    align-center
    append-to-body
    class="cloud-sync-dialog-wrapper"
    destroy-on-close
    :show-close="false"
    :close-on-press-escape="!isBusy"
    :close-on-click-modal="!isBusy"
    width="min(980px, calc(100vw - 64px))"
    @update:model-value="handleVisibilityChange"
    @open="handleOpen"
  >
    <div class="cloud-sync-dialog">
      <div class="dialog-hero">
        <div class="dialog-title">云同步清单</div>
        <div class="dialog-stats">
          <span class="stat-pill">差异文件 {{ preview.bookItems.length }}</span>
          <span class="stat-pill stat-pill--upload">可上传 {{ preview.uploadCount }}</span>
          <span class="stat-pill stat-pill--download">可下载 {{ preview.downloadCount }}</span>
          <span class="stat-pill stat-pill--neutral">正常 {{ preview.normalCount }}</span>
          <span class="stat-pill stat-pill--active">已选 {{ selectedCount }}</span>
        </div>
      </div>

      <div v-if="previewLoading" class="dialog-loading">
        正在读取云端与本地文件差异...
      </div>

      <div v-else-if="loadError" class="dialog-error-panel">
        <div class="dialog-error-title">读取同步信息失败</div>
        <div class="dialog-error-text">{{ loadError }}</div>
        <el-button type="primary" @click="loadPreview">重新加载</el-button>
      </div>

      <template v-else>
        <el-scrollbar class="sync-scrollbar">
          <div v-if="preview.bookItems.length > 0" class="sync-file-list">
            <section
              v-for="item in preview.bookItems"
              :key="item.fileName"
              class="sync-file-row"
            >
              <div class="sync-file-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
                </svg>
              </div>

              <div class="sync-file-main">
                <div class="sync-file-name">
                  <span class="sync-file-name-base">{{ splitFileName(item.fileName).base }}</span>
                  <span class="sync-file-name-ext">{{ splitFileName(item.fileName).ext }}</span>
                </div>
                <div class="sync-file-meta">
                  <span
                    class="state-pill"
                    :class="item.localExists ? 'state-pill--exists' : 'state-pill--missing'"
                  >
                    <svg v-if="item.localExists" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    本地{{ item.localExists ? '存在' : '缺失' }}
                  </span>
                  <span
                    class="state-pill"
                    :class="item.cloudExists ? 'state-pill--exists' : 'state-pill--missing'"
                  >
                    <svg v-if="item.cloudExists" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    云端{{ item.cloudExists ? '存在' : '缺失' }}
                  </span>
                  <span
                    class="action-badge"
                    :class="
                      item.status === 'upload'
                        ? 'action-badge--upload'
                        : 'action-badge--download'
                    "
                  >
                    <svg v-if="item.status === 'upload'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path><polyline points="16 16 12 12 8 16"></polyline></svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path><polyline points="8 17 12 21 16 17"></polyline></svg>
                    {{ item.status === 'upload' ? '可上传' : '可下载' }}
                  </span>
                </div>
              </div>

              <div class="sync-file-selection">
                <button
                  class="state-action-btn"
                  :class="{ 'is-active': draftSelections[item.fileName] }"
                  :disabled="applying"
                  @click="updateSelection(item.fileName, !draftSelections[item.fileName])"
                >
                  <svg v-if="draftSelections[item.fileName]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>
                  {{ draftSelections[item.fileName] ? '待执行' : '不执行' }}
                </button>
              </div>
            </section>
          </div>

          <div v-else class="sync-empty-state">
            <el-empty
              description="books 目录当前没有差异文件"
              :image-size="120"
            />
            <div class="sync-empty-tip">
              仍然可以执行同步，本次会继续检查并补齐 `bookProgress` 配置。
            </div>
          </div>
        </el-scrollbar>
      </template>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button :disabled="isBusy" @click="closeDialog">取消</el-button>
        <el-button
          type="primary"
          :loading="applying"
          :disabled="previewLoading || Boolean(loadError)"
          @click="executeSync"
        >
          {{ executeButtonLabel }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { computed, defineComponent, reactive, ref } from 'vue'
import { showMainTaskMessage } from '@/services/notification/mainTaskMessageService'
import {
  EMPTY_CLOUD_SYNC_PREVIEW,
  applyCloudSyncPlan,
  buildCloudSyncApplyRequest,
  buildDefaultCloudSyncSelectionMap,
  getCloudSyncPreview,
  toCloudSyncErrorMessage,
} from '@/services/sync/cloudSyncService'
import type { CloudSyncApplyResult, CloudSyncPreviewResult } from '@/types/sync'

export default defineComponent({
  name: 'CloudSyncDialog',
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue', 'synced'],
  setup(_, { emit }) {
    const previewLoading = ref(false)
    const applying = ref(false)
    const loadError = ref('')
    const preview = ref<CloudSyncPreviewResult>({ ...EMPTY_CLOUD_SYNC_PREVIEW })
    const draftSelections = reactive<Record<string, boolean>>({})

    const isBusy = computed(() => previewLoading.value || applying.value)
    const selectedCount = computed(() =>
      preview.value.bookItems.filter((item) => draftSelections[item.fileName]).length
    )
    const executeButtonLabel = computed(() =>
      selectedCount.value > 0 ? `执行云同步（${selectedCount.value} 项）` : '执行云同步'
    )

    const replaceDraftSelections = (nextSelections: Record<string, boolean>) => {
      for (const key of Object.keys(draftSelections)) {
        delete draftSelections[key]
      }

      Object.assign(draftSelections, nextSelections)
    }

    const loadPreview = async () => {
      previewLoading.value = true
      loadError.value = ''

      try {
        const nextPreview = await getCloudSyncPreview()
        preview.value = nextPreview
        replaceDraftSelections(buildDefaultCloudSyncSelectionMap(nextPreview.bookItems))
      } catch (error) {
        const message = toCloudSyncErrorMessage(error)
        preview.value = { ...EMPTY_CLOUD_SYNC_PREVIEW }
        replaceDraftSelections({})
        loadError.value = message
        showMainTaskMessage({
          type: 'error',
          title: '读取云同步信息失败',
          message,
          taskKey: 'cloud-sync-preview',
        })
      } finally {
        previewLoading.value = false
      }
    }

    const handleOpen = async () => {
      await loadPreview()
    }

    const handleVisibilityChange = (value: boolean) => {
      if (!value && isBusy.value) {
        return
      }

      emit('update:modelValue', value)
    }

    const closeDialog = () => {
      if (isBusy.value) {
        return
      }

      emit('update:modelValue', false)
    }

    const splitFileName = (fileName: string) => {
      const lastDotIndex = fileName.lastIndexOf('.')
      if (lastDotIndex === -1) {
        return { base: fileName, ext: '' }
      }
      return {
        base: fileName.slice(0, lastDotIndex),
        ext: fileName.slice(lastDotIndex)
      }
    }

    const updateSelection = (fileName: string, checked: boolean) => {
      draftSelections[fileName] = checked
    }

    const executeSync = async () => {
      if (previewLoading.value || applying.value || loadError.value) {
        return
      }

      applying.value = true

      try {
        const request = buildCloudSyncApplyRequest(preview.value.bookItems, draftSelections)
        const result = await applyCloudSyncPlan(request)
        emit('synced', result as CloudSyncApplyResult)
        emit('update:modelValue', false)
      } catch (error) {
        showMainTaskMessage({
          type: 'error',
          title: '云同步失败',
          message: toCloudSyncErrorMessage(error),
          taskKey: 'cloud-sync-apply',
        })
      } finally {
        applying.value = false
      }
    }

    return {
      previewLoading,
      applying,
      loadError,
      preview,
      draftSelections,
      isBusy,
      selectedCount,
      executeButtonLabel,
      loadPreview,
      handleOpen,
      handleVisibilityChange,
      closeDialog,
      splitFileName,
      updateSelection,
      executeSync,
    }
  },
})
</script>

<style lang="scss" scoped>
.cloud-sync-dialog {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  color: var(--text-primary);

  .dialog-hero {
    padding: 18px 20px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-default);
    background: var(--surface-strong);
    box-shadow: var(--shadow-sm), var(--shadow-inset-light);
  }

  .dialog-title {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.01em;
  }

  .dialog-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 2px;
  }

  .stat-pill {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--border-default);
    background: var(--surface-card-soft);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 700;
  }

  .stat-pill--upload {
    border-color: var(--border-success);
    background: var(--surface-success-soft);
    color: var(--text-success);
  }

  .stat-pill--download {
    border-color: var(--border-warning);
    background: var(--surface-warning-soft);
    color: var(--warning);
  }

  .stat-pill--neutral {
    background: var(--surface-card-soft);
  }

  .stat-pill--active {
    border-color: var(--border-brand);
    background: var(--surface-brand-soft);
    color: var(--brand-primary);
  }

  .dialog-loading,
  .dialog-error-panel,
  .sync-empty-state {
    min-height: 260px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 12px;
  }

  .dialog-loading {
    color: var(--text-tertiary);
    font-size: 14px;
  }

  .dialog-error-panel {
    padding: 24px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-danger);
    background: var(--surface-danger-gradient);
  }

  .dialog-error-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-danger);
  }

  .dialog-error-text {
    color: var(--text-secondary);
    text-align: center;
    line-height: 1.6;
  }

  .sync-scrollbar {
    display: flex;
    flex-direction: column;
    min-height: 0;
    max-height: min(52vh, 540px);
    padding-right: 4px;
  }

  .sync-file-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 4px 2px;
  }

  .sync-file-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 20px;
    align-items: center;
    padding: 20px 24px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-default);
    background: linear-gradient(180deg, var(--surface-strong), var(--surface-card-soft));
    box-shadow: var(--shadow-xs);
    transition:
      box-shadow var(--duration-fast) var(--easing-standard),
      border-color var(--duration-fast) var(--easing-standard);

    &:hover {
      box-shadow: var(--shadow-sm);
      border-color: var(--border-emphasis);
    }
  }

  .sync-file-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: var(--surface-card);
    color: var(--text-brand, var(--brand-primary));
    border: 1px solid var(--border-soft);

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .sync-file-main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .sync-file-name {
    display: flex;
    align-items: baseline;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .sync-file-name-base {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .sync-file-name-ext {
    font-size: 14px;
    color: var(--text-secondary);
    margin-left: 2px;
    background: var(--surface-brand-soft);
    border-radius: var(--radius-xs);
    margin-left: 6px;
    padding: 0 8px;
  }

  .sync-file-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }

  .state-pill,
  .action-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 28px;
    padding: 0 10px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--border-default);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;

    svg {
      width: 13px;
      height: 13px;
    }
  }

  .state-pill--exists {
    border-color: var(--border-success);
    background: var(--surface-success-soft);
    color: var(--text-success);
  }

  .state-pill--missing {
    border-color: var(--border-warning);
    background: var(--surface-warning-soft);
    color: var(--text-warning);
  }

  .action-badge--upload,
  .action-badge--download {
    border-color: var(--border-brand);
    background: var(--surface-brand-soft);
    color: var(--brand-primary);
  }

  .sync-file-selection {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .state-action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 90px;
    height: 36px;
    padding: 0 16px;
    border-radius: var(--radius-md);
    background: transparent;
    border: 1px solid var(--border-default);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    outline: none;
    transition: all var(--duration-base) var(--easing-standard);

    svg {
      width: 14px;
      height: 14px;
    }

    &:hover:not(:disabled) {
      background: var(--surface-card);
      border-color: var(--border-emphasis);
      color: var(--text-primary);
    }

    &:active:not(:disabled) {
      transform: scale(0.96);
    }

    &.is-active {
      background: var(--surface-brand-strong);
      border-color: var(--surface-brand-strong);
      color: #ffffff;
      box-shadow: var(--shadow-sm);

      &:hover:not(:disabled) {
        opacity: 0.9;
      }
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .sync-empty-tip {
    max-width: 420px;
    color: var(--text-tertiary);
    text-align: center;
    line-height: 1.7;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@media (max-width: 820px) {
  .cloud-sync-dialog {
    .dialog-hero {
      padding: 16px;
    }

    .dialog-title {
      font-size: 21px;
    }

    .sync-file-row {
      grid-template-columns: 1fr;
      gap: 14px;
    }

    .sync-file-selection {
      justify-content: flex-start;
    }
  }
}
</style>

<style lang="scss">
.cloud-sync-dialog-wrapper {
  display: flex;
  flex-direction: column;
  max-height: min(84vh, 920px);
  border-radius: var(--radius-xl);
  overflow: hidden;

  .el-dialog__header {
    display: none;
  }

  .el-dialog__body {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 22px;
    overflow: hidden;
  }

  .el-dialog__footer {
    padding: 22px;
  }

  .el-dialog__footer .el-button:hover,
  .el-dialog__footer .el-button:focus-visible,
  .el-dialog__footer .el-button:active {
    transform: none;
  }

  .el-scrollbar__wrap {
    overflow-x: hidden;

    &::-webkit-scrollbar {
      width: var(--t-scrollbar-width-thin);
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background-color: var(--scrollbar-thumb);
      border-radius: var(--radius-pill);
    }

    &:hover::-webkit-scrollbar-thumb {
      background-color: var(--scrollbar-thumb-strong);
    }
  }
}
</style>
