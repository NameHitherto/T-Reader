<template>
  <div class="cloud-sync-page">
    <div class="cloud-sync-panel">
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

      <div v-if="previewLoading" class="dialog-loading">正在读取云端与本地文件差异...</div>

      <div v-else-if="loadError" class="dialog-error-panel">
        <div class="error-icon-wrapper">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>

        <div class="dialog-error-title">读取同步信息失败</div>
        <div class="dialog-error-text">{{ loadError }}</div>

        <el-button class="error-retry-btn" @click="loadPreview">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="btn-icon"
          >
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          重新加载
        </el-button>
      </div>

      <template v-else>
        <el-scrollbar class="sync-scrollbar">
          <div v-if="preview.bookItems.length > 0" class="sync-file-list">
            <section v-for="item in preview.bookItems" :key="item.fileName" class="sync-file-row">
              <div class="sync-file-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
                </svg>
              </div>

              <div class="sync-file-main">
                <div class="sync-file-name">
                  <span class="sync-file-name-base">{{ splitPath(item.fileName).stem }}</span>
                  <span class="sync-file-name-ext">{{ splitPath(item.fileName).ext }}</span>
                </div>
                <div class="sync-file-meta">
                  <span
                    class="state-pill"
                    :class="item.localExists ? 'state-pill--exists' : 'state-pill--missing'"
                  >
                    <svg
                      v-if="item.localExists"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <svg
                      v-else
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    本地{{ item.localExists ? '存在' : '缺失' }}
                  </span>
                  <span
                    class="state-pill"
                    :class="item.cloudExists ? 'state-pill--exists' : 'state-pill--missing'"
                  >
                    <svg
                      v-if="item.cloudExists"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <svg
                      v-else
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    云端{{ item.cloudExists ? '存在' : '缺失' }}
                  </span>
                  <span
                    class="action-badge"
                    :class="
                      item.status === 'upload' ? 'action-badge--upload' : 'action-badge--download'
                    "
                  >
                    <svg
                      v-if="item.status === 'upload'"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="16 16 12 12 8 16"></polyline>
                      <line x1="12" y1="12" x2="12" y2="21"></line>
                      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path>
                      <polyline points="16 16 12 12 8 16"></polyline>
                    </svg>
                    <svg
                      v-else
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="8 17 12 21 16 17"></polyline>
                      <line x1="12" y1="12" x2="12" y2="21"></line>
                      <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path>
                      <polyline points="8 17 12 21 16 17"></polyline>
                    </svg>
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
                  <svg
                    v-if="draftSelections[item.fileName]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <svg
                    v-else
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                  </svg>
                  {{ draftSelections[item.fileName] ? '待执行' : '不执行' }}
                </button>
              </div>
            </section>
          </div>

          <div v-else class="sync-empty-state">
            <el-empty description="books 目录当前没有差异文件" :image-size="120" />
            <div class="sync-empty-tip">
              仍然可以执行同步，本次会继续检查并补齐 `bookProgress` 配置。
            </div>
          </div>
        </el-scrollbar>
      </template>
    </div>

    <footer class="cloud-sync-page-footer">
      <div class="cloud-sync-page-tip">
        同步前会再次核对本地与云端状态，执行期间请保持网络连接。
      </div>
      <div class="cloud-sync-page-actions">
        <el-button :disabled="isBusy" @click="loadPreview">重新检查</el-button>
        <el-button
          type="primary"
          :loading="applying"
          :disabled="previewLoading || Boolean(loadError)"
          @click="executeSync"
        >
          执行云同步
        </el-button>
      </div>
    </footer>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { invalidateBookFileCache } from '@/services/book/repository'
import { showMainTaskMessage } from '@/services/notification'
import {
  EMPTY_CLOUD_SYNC_PREVIEW,
  applyCloudSyncPlan,
  buildCloudSyncApplyRequest,
  buildDefaultCloudSyncSelectionMap,
  formatCloudSyncResultMessage,
  getCloudSyncPreview,
} from '@/services/sync'
import { toHttpResponseMessage } from '@/services/sync/response'
import type { CloudSyncPreviewResult } from '@/services/sync/types'
import { splitPath } from '@/utils/path'

export default defineComponent({
  name: 'CloudSyncView',
  setup() {
    const previewLoading = ref(false)
    const applying = ref(false)
    const loadError = ref('')
    const preview = ref<CloudSyncPreviewResult>({ ...EMPTY_CLOUD_SYNC_PREVIEW })
    const draftSelections = reactive<Record<string, boolean>>({})

    const isBusy = computed(() => previewLoading.value || applying.value)
    const selectedCount = computed(
      () => preview.value.bookItems.filter((item) => draftSelections[item.fileName]).length,
    )
    const executeButtonLabel = computed(() =>
      selectedCount.value > 0 ? `执行云同步（${selectedCount.value} 项）` : '执行云同步',
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
        const message = toHttpResponseMessage(error)
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
        invalidateBookFileCache()
        showMainTaskMessage({
          type: 'success',
          title: '云同步完成',
          message: formatCloudSyncResultMessage(result),
          taskKey: 'cloud-sync-apply',
        })
        await loadPreview()
      } catch (error) {
        showMainTaskMessage({
          type: 'error',
          title: '云同步失败',
          message: toHttpResponseMessage(error),
          taskKey: 'cloud-sync-apply',
        })
      } finally {
        applying.value = false
      }
    }

    onBeforeRouteLeave(() => {
      if (!applying.value) {
        return true
      }

      showMainTaskMessage({
        type: 'warning',
        title: '云同步正在执行',
        message: '请等待当前同步任务完成后再离开此页面。',
        taskKey: 'cloud-sync-route-guard',
      })
      return false
    })

    onMounted(() => {
      void loadPreview()
    })

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
      updateSelection,
      executeSync,
      splitPath
    }
  },
})
</script>

<style lang="scss" scoped>
.cloud-sync-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 24px 28px 18px;
  overflow: hidden;
  color: var(--text-primary);
  background: var(--app-bg-accent);
}

.cloud-sync-panel {
  flex: 1;
  min-height: 0;
}

.cloud-sync-page-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-shrink: 0;
  padding: 16px 20px 0;
  margin-top: 16px;
  border-top: 1px solid var(--border-soft);
}

.cloud-sync-page-tip {
  color: var(--text-tertiary);
  font-size: 13px;
  line-height: 1.5;
}

.cloud-sync-page-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.cloud-sync-panel {
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
    min-height: 280px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px 24px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-default);
    background: var(--surface-strong);
    box-shadow: var(--shadow-xs);
  }

  .error-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    margin-bottom: 4px;
    border-radius: 50%;
    background: var(--surface-danger-soft);
    color: var(--text-danger);

    svg {
      width: 24px;
      height: 24px;
    }
  }

  .dialog-error-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-top: 4px;
  }

  .dialog-error-text {
    font-size: 13px;
    color: var(--text-tertiary);
    text-align: center;
    max-width: 360px;
    line-height: 1.6;
    margin-bottom: 8px;
  }

  .error-retry-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 20px;
    height: 38px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-default);
    background: var(--surface-strong);
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 500;
    transition: all var(--duration-fast) var(--easing-standard);

    .btn-icon {
      width: 14px;
      height: 14px;
      color: var(--text-secondary);
    }

    &:hover,
    &:focus {
      background: var(--surface-card);
      border-color: var(--border-emphasis);
      color: var(--brand-primary);

      .btn-icon {
        color: var(--brand-primary);
      }
    }
  }

  .sync-scrollbar {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
    max-height: none;
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
    background: var(--surface-strong);
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

@media (max-width: 820px) {
  .cloud-sync-panel {
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

@media (max-width: 760px) {
  .cloud-sync-page {
    padding: 18px;
  }

  .cloud-sync-page-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .cloud-sync-page-actions {
    justify-content: flex-end;
  }
}
</style>
