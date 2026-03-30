<template>
  <el-dialog
    :model-value="modelValue"
    align-center
    append-to-body
    class="system-font-enable-dialog-wrapper"
    destroy-on-close
    modal-class="system-font-enable-dialog-overlay"
    :show-close="false"
    width="min(1080px, calc(100vw - 360px))"
    @update:model-value="handleVisibilityChange"
    @open="handleOpen"
  >
    <div class="system-font-enable-dialog">
      <div class="dialog-hero">
        <div class="dialog-title">启用系统字体</div>
        <div class="dialog-subtitle">
          先启用，再在阅读样式中选择。每个字体家族只保留一个启用样式。
        </div>
        <div class="dialog-stats">
          <span class="stat-pill">系统字体家族 {{ fontFamilyGroups.length }}</span>
          <span class="stat-pill stat-pill--active">已启用 {{ selectedCount }}</span>
        </div>
      </div>

      <div v-if="loading" class="dialog-loading">
        正在读取系统字体...
      </div>

      <el-scrollbar v-else>
        <div v-if="orderedFontFamilyGroups.length > 0" class="font-grid">
          <section
            v-for="group in orderedFontFamilyGroups"
            :key="group.family"
            class="font-card"
            :class="{ 'font-card--active': Boolean(draftSelections[group.family]) }"
          >
            <div class="font-card-header">
              <div>
                <div class="font-card-title">{{ group.family }}</div>
                <div class="font-card-meta">
                  {{ group.entries.length }} 个样式可选
                </div>
              </div>
              <span v-if="draftSelections[group.family]" class="font-card-status">
                已启用
              </span>
              <span v-else class="font-card-status font-card-status--muted">
                未启用
              </span>
            </div>

            <div
              class="font-preview"
              :style="{ fontFamily: getPreviewFontValue(group.family) }"
            >
              <div class="font-preview-caption">字体预览</div>
              <div class="font-preview-title">洛琪希 赛高！</div>
              <div class="font-preview-text">{{ previewText }}</div>
            </div>

            <div class="font-control-panel">
              <el-radio-group
                :model-value="getFamilyMode(group.family)"
                class="family-toggle-group"
                @update:model-value="(value: string | number | boolean) => changeFamilyMode(group, String(value))"
              >
                <el-radio-button value="disabled">不启用</el-radio-button>
                <el-radio-button value="enabled">启用</el-radio-button>
              </el-radio-group>

              <div
                v-if="getFamilyMode(group.family) === 'enabled'"
                class="family-style-picker"
              >
                <div class="family-style-head">
                  <span class="family-style-label">启用样式</span>
                  <span class="family-style-current">{{ getSelectedEntryLabel(group) }}</span>
                </div>

                <el-select
                  v-if="group.entries.length > 1"
                  :model-value="draftSelections[group.family]"
                  class="family-style-select"
                  placeholder="选择要启用的子字体"
                  @update:model-value="(value: string | number | boolean) => selectFamilyEntry(group.family, String(value))"
                >
                  <el-option
                    v-for="entry in group.entries"
                    :key="getSystemFontEntryKey(entry)"
                    :label="formatStyleLabel(entry)"
                    :value="getReaderFontValue(entry)"
                  />
                </el-select>

                <div v-else class="family-style-single">
                  {{ formatStyleLabel(group.entries[0]) }}
                </div>
              </div>
            </div>
          </section>
        </div>

        <el-empty
          v-else
          description="当前没有读取到系统字体"
          :image-size="120"
        />
      </el-scrollbar>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="closeDialog">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveSelection">
          保存启用项
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, computed, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useReaderConfigStore } from '@/store/readerConfigStore'
import { saveReaderConfigToDisk } from '@/services/reader/readerConfigService'
import { logError } from '@/utils/logger'
import {
  fetchSystemFonts,
  findSystemFontMatch,
  formatSystemFontLabel,
  getEnabledFontByValue,
  getReaderFontValue,
  getSystemFontEntryKey,
  groupSystemFontsByFamily,
  toEnabledSystemFont,
} from '@/services/reader/systemFontService'
import { WINDOW_EVENTS } from '@/constants/events'
import {
  DEFAULT_READER_FONT,
  SYSTEM_FONT_PREVIEW_TEXT,
  type EnabledSystemFont,
  type SystemFontEntry,
} from '@/types/readerFonts'

export default defineComponent({
  name: 'SystemFontEnableDialog',
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue', 'saved'],
  setup(_, { emit }) {
    const readerConfigStore = useReaderConfigStore()
    const { readerConfig } = storeToRefs(readerConfigStore)

    const loading = ref(false)
    const saving = ref(false)
    const systemFonts = ref<SystemFontEntry[]>([])
    const draftSelections = reactive<Record<string, string>>({})

    const fontFamilyGroups = computed(() => groupSystemFontsByFamily(systemFonts.value))
    const orderedFontFamilyGroups = computed(() => {
      const enabledGroups = fontFamilyGroups.value
        .filter((group) => Boolean(draftSelections[group.family]))
        .sort((left, right) => left.family.localeCompare(right.family))
      const disabledGroups = fontFamilyGroups.value
        .filter((group) => !draftSelections[group.family])
        .sort((left, right) => left.family.localeCompare(right.family))
      return [...enabledGroups, ...disabledGroups]
    })
    const previewText = SYSTEM_FONT_PREVIEW_TEXT
    const selectedCount = computed(() =>
      Object.values(draftSelections).filter((value) => Boolean(value)).length
    )

    const resetDraftSelections = () => {
      const nextSelections: Record<string, string> = {}

      for (const font of readerConfig.value.enabledSystemFonts) {
        nextSelections[font.family] = getReaderFontValue(font)
      }

      for (const key of Object.keys(draftSelections)) {
        delete draftSelections[key]
      }

      Object.assign(draftSelections, nextSelections)
    }

    const loadSystemFonts = async () => {
      loading.value = true
      try {
        systemFonts.value = await fetchSystemFonts()
      } finally {
        loading.value = false
      }
    }

    const ensureSystemFonts = async () => {
      if (systemFonts.value.length > 0 || loading.value) {
        return
      }
      await loadSystemFonts()
    }

    const handleOpen = async () => {
      await ensureSystemFonts()
      resetDraftSelections()
    }

    const handleVisibilityChange = (value: boolean) => {
      emit('update:modelValue', value)
    }

    const closeDialog = () => {
      emit('update:modelValue', false)
    }

    const updateSelection = (family: string, value: string) => {
      if (!value) {
        delete draftSelections[family]
        return
      }

      draftSelections[family] = value
    }

    const getFamilyMode = (family: string) => {
      return draftSelections[family] ? 'enabled' : 'disabled'
    }

    const selectFamilyEntry = (family: string, value: string) => {
      updateSelection(family, value)
    }

    const changeFamilyMode = (
      group: { family: string; entries: SystemFontEntry[] },
      mode: string
    ) => {
      if (mode === 'disabled') {
        updateSelection(group.family, '')
        return
      }

      const currentValue = draftSelections[group.family]
      if (currentValue) {
        return
      }

      const defaultEntry = group.entries[0]
      if (defaultEntry) {
        updateSelection(group.family, getReaderFontValue(defaultEntry))
      }
    }

    const getPreviewFontValue = (family: string) => {
      const selectedValue = draftSelections[family]
      if (selectedValue) {
        return selectedValue
      }

      const matchedFont = findSystemFontMatch(family, systemFonts.value)
      return matchedFont ? getReaderFontValue(matchedFont) : family
    }

    const formatStyleLabel = (font: SystemFontEntry) => {
      const label = formatSystemFontLabel(font)
      if (font.weight) {
        return `${label} / ${font.weight}`
      }
      return label
    }

    const getSelectedEntryLabel = (group: { family: string; entries: SystemFontEntry[] }) => {
      const selectedValue = draftSelections[group.family]
      const selectedEntry = group.entries.find(
        (entry) => getReaderFontValue(entry) === selectedValue
      )

      if (selectedEntry) {
        return formatStyleLabel(selectedEntry)
      }

      return group.entries.length > 0 ? formatStyleLabel(group.entries[0]) : '未选择'
    }

    const saveSelection = async () => {
      saving.value = true

      try {
        const nextEnabledFonts: EnabledSystemFont[] = orderedFontFamilyGroups.value.flatMap((group) => {
          const selectedValue = draftSelections[group.family]
          if (!selectedValue) {
            return []
          }

          const selectedEntry = group.entries.find(
            (entry) => getReaderFontValue(entry) === selectedValue
          )

          return selectedEntry ? [toEnabledSystemFont(selectedEntry)] : []
        })

        readerConfigStore.changeState('enabledSystemFonts', nextEnabledFonts)

        if (readerConfig.value.font !== DEFAULT_READER_FONT) {
          const matchedFont = getEnabledFontByValue(nextEnabledFonts, readerConfig.value.font)
          if (matchedFont) {
            readerConfigStore.changeState('font', getReaderFontValue(matchedFont))
          } else {
            readerConfigStore.changeState('font', DEFAULT_READER_FONT)
          }
        }

        await saveReaderConfigToDisk(readerConfig.value)
        await getCurrentWebviewWindow().emitTo('reader', WINDOW_EVENTS.UPDATE_READER_STYLE)

        emit('saved', {
          enabledFonts: nextEnabledFonts,
          currentFont: readerConfig.value.font,
        })
        closeDialog()
      } catch (error) {
        logError('systemFont', '保存系统字体启用项失败', error)
      } finally {
        saving.value = false
      }
    }

    return {
      loading,
      saving,
      previewText,
      draftSelections,
      fontFamilyGroups,
      orderedFontFamilyGroups,
      selectedCount,
      closeDialog,
      handleOpen,
      handleVisibilityChange,
      updateSelection,
      getFamilyMode,
      changeFamilyMode,
      selectFamilyEntry,
      getPreviewFontValue,
      formatStyleLabel,
      getSelectedEntryLabel,
      saveSelection,
      getReaderFontValue,
      getSystemFontEntryKey,
    }
  },
})
</script>

<style lang="scss" scoped>
.system-font-enable-dialog {
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

  .dialog-subtitle {
    margin-top: 6px;
    color: var(--text-tertiary);
    font-size: 14px;
    line-height: 1.6;
  }

  .dialog-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 14px;
  }

  .stat-pill {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    border-radius: var(--radius-pill);
    background: var(--surface-card-soft);
    border: 1px solid var(--border-default);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
  }

  .stat-pill--active {
    background: var(--surface-brand-soft);
    color: var(--brand-primary);
    border-color: var(--border-brand);
  }

  .dialog-loading {
    min-height: 240px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    font-size: 14px;
  }

  .font-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    gap: 18px;
    padding: 4px 2px;
    overflow-x: hidden;
  }

  .font-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
    padding: 18px;
    background: var(--surface-strong);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    transition:
      transform var(--duration-fast) var(--easing-standard),
      box-shadow var(--duration-fast) var(--easing-standard),
      border-color var(--duration-fast) var(--easing-standard);

    &:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
  }

  .font-card--active {
    border-color: var(--border-brand);
    box-shadow:
      var(--shadow-md),
      0 0 0 2px var(--ring-brand-subtle);
  }

  .font-card-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .font-card-title {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.35;
  }

  .font-card-meta {
    margin-top: 4px;
    color: var(--text-muted);
    font-size: 12px;
  }

  .font-card-status {
    display: inline-flex;
    align-items: center;
    padding: 5px 10px;
    border-radius: var(--radius-pill);
    background: var(--surface-brand-soft);
    color: var(--brand-primary);
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  .font-card-status--muted {
    background: var(--surface-card-soft);
    color: var(--text-tertiary);
  }

  .font-preview {
    padding: 18px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-default);
    background: linear-gradient(180deg, var(--surface-strong), var(--surface-card-soft));
  }

  .font-preview-caption {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .font-preview-title {
    margin-top: 8px;
    font-size: 24px;
    font-weight: 700;
    line-height: 1.2;
  }

  .font-preview-text {
    margin-top: 8px;
    font-size: 14px;
    line-height: 1.8;
    color: var(--text-secondary);
  }

  .font-control-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  .family-toggle-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .family-toggle-group,
  .font-style-group {
    :deep(.el-radio-button__inner) {
      border-radius: var(--radius-pill) !important;
      border: 1px solid var(--border-default) !important;
      box-shadow: none !important;
      padding: 8px 14px;
      background: var(--surface-strong);
      color: var(--text-secondary);
      font-weight: 600;
    }

    :deep(.el-radio-button:first-child .el-radio-button__inner),
    :deep(.el-radio-button:last-child .el-radio-button__inner) {
      border-radius: 999px !important;
    }

    :deep(.el-radio-button.is-active .el-radio-button__inner) {
      background: var(--surface-brand-strong);
      border-color: var(--surface-brand-strong) !important;
      color: var(--text-on-brand);
    }
  }

  .family-style-picker {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    padding: 14px;
    border-radius: 14px;
    border: 1px solid var(--border-default);
    background: var(--surface-card-soft);
  }

  .family-style-head {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
    min-width: 0;
  }

  .family-style-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-tertiary);
    white-space: nowrap;
  }

  .family-style-current {
    min-width: 0;
    font-size: 12px;
    color: var(--text-secondary);
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .family-style-select {
    width: 100%;
  }

  .family-style-single {
    padding: 11px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-default);
    background: var(--surface-strong);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 600;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@media (max-width: 720px) {
  .system-font-enable-dialog {
    .dialog-hero {
      padding: 16px;
    }

    .dialog-title {
      font-size: 21px;
    }

    .font-grid {
      grid-template-columns: 1fr;
    }

    .font-card {
      padding: 16px;
      border-radius: 16px;
    }
  }
}
</style>

<style lang="scss">
.system-font-enable-dialog-wrapper {
  display: flex;
  flex-direction: column;
  max-height: min(82vh, 920px);
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

  .el-scrollbar {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .el-scrollbar__wrap {
    display: flex;
    flex-direction: column;
    min-height: 0;
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
