<template>
  <el-dialog
    :model-value="modelValue"
    align-center
    append-to-body
    class="system-font-select-dialog-wrapper"
    destroy-on-close
    :show-close="true"
    width="min(1080px, calc(100vw - 80px))"
    @update:model-value="handleVisibilityChange"
    @open="handleOpen"
  >
    <template #header>
      <div class="dialog-header">
        <span class="dialog-header__title">选择系统字体</span>
      </div>
    </template>

    <div v-loading="loading" class="system-font-workbench">
      <!-- 左侧：字体家族列表检索 -->
      <aside class="workbench-master">
        <div class="master-search">
          <el-input
            v-model="searchKeyword"
            clearable
            placeholder="搜索中英文家族名、样式或 PostScript"
          />
        </div>

        <div class="master-filter-tabs">
          <button
            type="button"
            class="filter-chip"
            :class="{ 'filter-chip--active': activeFilterTab === 'all' }"
            @click="activeFilterTab = 'all'"
          >
            全部 ({{ filteredBySearchGroups.length }})
          </button>
          <button
            type="button"
            class="filter-chip"
            :class="{ 'filter-chip--active': activeFilterTab === 'enabled' }"
            @click="activeFilterTab = 'enabled'"
          >
            已启用 ({{ selectedCount }})
          </button>
        </div>

        <div class="master-list-container">
          <el-scrollbar v-if="displayedGroups.length > 0">
            <div class="master-group-list">
              <div
                v-for="group in displayedGroups"
                :key="group.family"
                class="master-group-item"
                :class="{
                  'master-group-item--active': currentFamily === group.family,
                  'master-group-item--enabled': Boolean(draftSelections[group.family]),
                }"
                @click="selectFamily(group.family)"
              >
                <div class="group-item-main">
                  <div class="group-item-title">{{ group.displayFamily }}</div>
                  <div class="group-item-sub">
                    <span v-if="group.family !== group.displayFamily" class="group-item-en-family">
                      {{ group.family }} ·
                    </span>
                    <span>{{ group.entries.length }} 个样式</span>
                  </div>
                </div>

                <div class="group-item-status">
                  <span v-if="draftSelections[group.family]" class="status-tag status-tag--enabled">
                    已启用
                  </span>
                  <span v-else class="status-tag status-tag--idle">未启用</span>
                </div>
              </div>
            </div>
          </el-scrollbar>

          <el-empty
            v-else
            :description="searchKeyword ? '没有匹配的字体家族' : '暂无字体'"
            :image-size="80"
            class="master-empty"
          />
        </div>
      </aside>

      <!-- 右侧：详情排版工作台 -->
      <main class="workbench-detail">
        <div v-if="currentGroup" class="detail-content">
          <!-- 顶部信息与启用开关 -->
          <div class="detail-hero">
            <div class="detail-hero__info">
              <div class="detail-hero__title">{{ currentGroup.displayFamily }}</div>
              <div class="detail-hero__meta">
                <span v-if="currentGroup.family !== currentGroup.displayFamily" class="meta-item">
                  英文名称：{{ currentGroup.family }}
                </span>
                <span class="meta-item">样式总数：{{ currentGroup.entries.length }}</span>
                <span v-if="currentEntry?.weight" class="meta-item">
                  当前字重：{{ currentEntry.weight }}
                </span>
              </div>
            </div>

            <div class="detail-hero__action">
              <el-button
                v-if="!draftSelections[currentGroup.family]"
                type="primary"
                @click="enableCurrentFamily"
              >
                启用此字体
              </el-button>
              <el-button v-else type="danger" plain @click="disableCurrentFamily">
                取消启用
              </el-button>
            </div>
          </div>

          <!-- 子样式选择（多字重家族） -->
          <div v-if="currentGroup.entries.length > 1" class="detail-section detail-style-picker">
            <span class="detail-section__label">选择样式 / 字重</span>
            <el-select
              :model-value="draftSelections[currentGroup.family] || currentSelectedStyleValue"
              class="style-select"
              placeholder="选择字重样式"
              @update:model-value="onSelectStyleValue"
            >
              <el-option
                v-for="entry in currentGroup.entries"
                :key="getSystemFontEntryKey(entry)"
                :label="formatEntryLabel(entry)"
                :value="getReaderFontValue(entry)"
              />
            </el-select>
          </div>

          <!-- 排版测试区 -->
          <div class="detail-section typography-playground">
            <div class="playground-toolbar">
              <div class="toolbar-presets">
                <button
                  v-for="preset in previewPresets"
                  :key="preset.label"
                  type="button"
                  class="preset-button"
                  :class="{ 'preset-button--active': previewText === preset.text }"
                  @click="previewText = preset.text"
                >
                  {{ preset.label }}
                </button>
              </div>

              <div class="toolbar-size">
                <span class="size-label">{{ previewFontSize }}px</span>
                <el-slider
                  v-model="previewFontSize"
                  :min="14"
                  :max="48"
                  :step="1"
                  :show-tooltip="false"
                  class="size-slider"
                />
              </div>
            </div>

            <div class="playground-custom-input">
              <el-input
                v-model="previewText"
                placeholder="输入自定义预览文本以验证字形..."
                clearable
              />
            </div>

            <div class="playground-preview-card" :style="previewStyle">
              <div class="preview-headline">
                {{ previewText || '洛琪希 赛高！ 永和九年，岁在癸丑' }}
              </div>
              <div class="preview-specimen">
                ABCDEFGHIJKLMNOPQRSTUVWXYZ · abcdefghijklmnopqrstuvwxyz · 0123456789
              </div>
              <div class="preview-paragraph">
                读书是一种享受，优秀的字体排版能带来更沉浸的阅读体验。春风桃李花开日，秋雨梧桐叶落时。
                西当太白有鸟道，可以横绝峨眉巅。地崩山摧壮士死，然后天梯石栈相钩连。
              </div>
            </div>
          </div>

          <!-- 元数据信息栏 -->
          <div class="detail-section detail-meta-section">
            <span class="detail-section__label">字体解析数据</span>
            <div class="meta-grid">
              <div class="meta-card">
                <span class="meta-card__key">家族名称 (Family)</span>
                <span class="meta-card__val">{{ currentGroup.family }}</span>
              </div>
              <div class="meta-card">
                <span class="meta-card__key">显示家族 (Display Family)</span>
                <span class="meta-card__val">{{ currentGroup.displayFamily }}</span>
              </div>
              <div class="meta-card">
                <span class="meta-card__key">子家族 (Subfamily)</span>
                <span class="meta-card__val">{{ currentEntry?.subfamily || 'Regular' }}</span>
              </div>
              <div class="meta-card">
                <span class="meta-card__key">全名 (Full Name)</span>
                <span class="meta-card__val">{{ currentEntry?.fullName || '—' }}</span>
              </div>
              <div class="meta-card">
                <span class="meta-card__key">PostScript 名称</span>
                <span class="meta-card__val">{{ currentEntry?.postscriptName || '—' }}</span>
              </div>
              <div class="meta-card">
                <span class="meta-card__key">字重 (Weight)</span>
                <span class="meta-card__val">{{ currentEntry?.weight ?? 400 }}</span>
              </div>
            </div>
          </div>
        </div>

        <el-empty
          v-else
          description="请在左侧选择一个字体家族"
          :image-size="100"
          class="detail-empty"
        />
      </main>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-stats">
          已选择 <strong>{{ selectedCount }}</strong> 个系统字体作为可用项
        </div>
        <div class="footer-actions">
          <el-button @click="closeDialog">取消</el-button>
          <el-button type="primary" :loading="saving" @click="handleSave"> 保存启用项 </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch, type CSSProperties } from 'vue'
import {
  doesSystemFontGroupMatchKeyword,
  fetchSystemFonts,
  formatSystemFontLabel,
  getReaderFontValue,
  getSystemFontEntryKey,
  groupSystemFontsByFamily,
  orderSystemFontFamilyGroups,
  toEnabledSystemFont,
  type SystemFontFamilyGroup,
} from '@/services/reader/systemFonts'
import { buildLocalSrcValue, getReaderLocalFontCandidates } from '@/services/reader/fontApplication'
import {
  DEFAULT_READER_FONT,
  type EnabledSystemFont,
  type SystemFontEntry,
} from '@/services/reader/fontTypes'

const props = defineProps<{
  modelValue: boolean
  currentEnabledFonts?: EnabledSystemFont[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', enabledFonts: EnabledSystemFont[]): void
}>()

const WORKBENCH_PREVIEW_STYLE_ID = 'system-font-select-workbench-preview-style'
const WORKBENCH_PREVIEW_FAMILY = 'TReaderWorkbenchFontPreview'

const loading = ref(false)
const saving = ref(false)
const systemFonts = ref<SystemFontEntry[]>([])
const searchKeyword = ref('')
const activeFilterTab = ref<'all' | 'enabled'>('all')
const currentFamily = ref('')
const previewFontSize = ref(22)
const previewText = ref('洛琪希 赛高！')

const previewPresets = [
  { label: '二次元', text: '洛琪希 赛高！ Roxy Forever 123' },
  { label: '经典诗词', text: '永和九年，岁在癸丑，暮春之初，会于会稽山阴之兰亭。' },
  { label: '英文字母', text: 'The quick brown fox jumps over the lazy dog.' },
  { label: '数字与标点', text: '0123456789 「」【】（）！？#@￥%' },
]

// 存储各个 family 选用的 entry readerFontValue，若未启用则不存在该 key
const draftSelections = reactive<Record<string, string>>({})
// 存储当前右侧面板即使未启用时，所临时选中的样式 value
const previewSelectedStyles = reactive<Record<string, string>>({})

const fontFamilyGroups = computed(() => groupSystemFontsByFamily(systemFonts.value))

const orderedFontFamilyGroups = computed(() => {
  const enabledFamilies = Object.keys(draftSelections).filter((key) =>
    Boolean(draftSelections[key]),
  )

  return orderSystemFontFamilyGroups(fontFamilyGroups.value, enabledFamilies)
})

const filteredBySearchGroups = computed(() => {
  return orderedFontFamilyGroups.value.filter((group) =>
    doesSystemFontGroupMatchKeyword(group, searchKeyword.value),
  )
})

const displayedGroups = computed(() => {
  if (activeFilterTab.value === 'enabled') {
    return filteredBySearchGroups.value.filter((group) => Boolean(draftSelections[group.family]))
  }
  return filteredBySearchGroups.value
})

const selectedCount = computed(() => {
  return Object.values(draftSelections).filter(Boolean).length
})

const currentGroup = computed<SystemFontFamilyGroup | null>(() => {
  if (!currentFamily.value) return displayedGroups.value[0] || null
  return (
    fontFamilyGroups.value.find((g) => g.family === currentFamily.value) ||
    displayedGroups.value[0] ||
    null
  )
})

const currentSelectedStyleValue = computed<string>(() => {
  if (!currentGroup.value) return ''
  const family = currentGroup.value.family

  return (
    draftSelections[family] ||
    previewSelectedStyles[family] ||
    getReaderFontValue(currentGroup.value.entries[0])
  )
})

const currentEntry = computed<SystemFontEntry | null>(() => {
  if (!currentGroup.value) return null
  const styleValue = currentSelectedStyleValue.value

  return (
    currentGroup.value.entries.find((entry) => getReaderFontValue(entry) === styleValue) ||
    currentGroup.value.entries[0] ||
    null
  )
})

// 动态注入用于右侧详情预览的 @font-face 规则
const syncPreviewFontStyle = () => {
  const existing = document.getElementById(WORKBENCH_PREVIEW_STYLE_ID) as HTMLStyleElement | null

  if (!currentEntry.value) {
    existing?.remove()
    return
  }

  const localCandidates = getReaderLocalFontCandidates(
    currentEntry.value,
    getReaderFontValue(currentEntry.value),
  )

  if (localCandidates.length === 0) {
    existing?.remove()
    return
  }

  const fontFaceRule = `@font-face {
    font-family: "${WORKBENCH_PREVIEW_FAMILY}";
    src: ${buildLocalSrcValue(localCandidates)};
    font-display: swap;
  }`

  const styleEl = existing || document.createElement('style')
  styleEl.id = WORKBENCH_PREVIEW_STYLE_ID
  if (styleEl.textContent !== fontFaceRule) {
    styleEl.textContent = fontFaceRule
  }
  if (!styleEl.isConnected) {
    document.head.appendChild(styleEl)
  }
}

const removePreviewFontStyle = () => {
  document.getElementById(WORKBENCH_PREVIEW_STYLE_ID)?.remove()
}

watch(currentEntry, syncPreviewFontStyle, { immediate: true })
onBeforeUnmount(removePreviewFontStyle)

const previewStyle = computed<CSSProperties>(() => ({
  fontFamily: `"${WORKBENCH_PREVIEW_FAMILY}", ${DEFAULT_READER_FONT}`,
  fontSize: `${previewFontSize.value}px`,
}))

const selectFamily = (family: string) => {
  currentFamily.value = family
}

const formatEntryLabel = (entry: SystemFontEntry) => {
  const label = formatSystemFontLabel(entry)
  if (entry.fullName || entry.subfamily) {
    return label
  }
  if (entry.weight) {
    return `${label} (${entry.weight})`
  }
  return label
}

const onSelectStyleValue = (val: string | number | boolean) => {
  const value = String(val)
  if (!currentGroup.value) return
  const family = currentGroup.value.family
  previewSelectedStyles[family] = value
  if (draftSelections[family]) {
    draftSelections[family] = value
  }
}

const enableCurrentFamily = () => {
  if (!currentGroup.value) return
  const family = currentGroup.value.family
  const styleValue = currentSelectedStyleValue.value
  draftSelections[family] = styleValue
}

const disableCurrentFamily = () => {
  if (!currentGroup.value) return
  delete draftSelections[currentGroup.value.family]
}

const resetDraft = () => {
  for (const key of Object.keys(draftSelections)) {
    delete draftSelections[key]
  }
  for (const font of props.currentEnabledFonts || []) {
    draftSelections[font.family] = getReaderFontValue(font)
  }
}

const handleOpen = async () => {
  resetDraft()
  searchKeyword.value = ''
  activeFilterTab.value = 'all'

  if (systemFonts.value.length === 0) {
    loading.value = true
    try {
      systemFonts.value = await fetchSystemFonts()
    } finally {
      loading.value = false
    }
  }

  if (displayedGroups.value.length > 0) {
    currentFamily.value = displayedGroups.value[0].family
  }
}

const handleVisibilityChange = (value: boolean) => {
  emit('update:modelValue', value)
}

const closeDialog = () => {
  emit('update:modelValue', false)
}

const handleSave = () => {
  const nextEnabledFonts: EnabledSystemFont[] = fontFamilyGroups.value.flatMap((group) => {
    const selectedValue = draftSelections[group.family]
    if (!selectedValue) return []
    const selectedEntry = group.entries.find((entry) => getReaderFontValue(entry) === selectedValue)

    return selectedEntry ? [toEnabledSystemFont(selectedEntry)] : []
  })

  emit('save', nextEnabledFonts)
  closeDialog()
}
</script>

<style scoped lang="scss">
.system-font-select-dialog-wrapper {
  display: flex;
  flex-direction: column;
  color: var(--text-primary);
}

.dialog-header {
  display: flex;
  align-items: center;

  &__title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
  }
}

.system-font-workbench {
  display: flex;
  height: 580px;
  min-height: 0;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--surface-strong);
  overflow: hidden;
}

// ============================================================
// 左侧：Master 字体列表
// ============================================================
.workbench-master {
  display: flex;
  flex: 0 0 320px;
  flex-direction: column;
  min-width: 0;
  background: var(--surface-card);
  border-right: 1px solid var(--border-soft);
}

.master-search {
  padding: 12px 12px 8px;
}

.master-filter-tabs {
  display: flex;
  gap: 8px;
  padding: 0 12px 10px;
  border-bottom: 1px solid var(--border-soft);
}

.filter-chip {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-pill);
  background: var(--surface-strong);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-standard);

  &:hover {
    color: var(--brand-primary);
    border-color: var(--border-brand);
  }

  &--active {
    background: var(--surface-brand-soft);
    color: var(--brand-primary);
    border-color: var(--border-brand);
  }
}

.master-list-container {
  flex: 1;
  min-height: 0;
}

.master-group-list {
  display: flex;
  flex-direction: column;
  padding: 6px;
  gap: 4px;
}

.master-group-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-standard);

  &:hover {
    background: var(--surface-card-soft);
  }

  &--active {
    background: var(--surface-brand-soft) !important;
    border-color: var(--border-brand);
  }

  &--enabled {
    .group-item-title {
      color: var(--brand-primary);
      font-weight: 700;
    }
  }
}

.group-item-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.group-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-item-sub {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-item-status {
  flex-shrink: 0;
}

.status-tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;

  &--enabled {
    background: var(--surface-brand-soft);
    color: var(--brand-primary);
  }

  &--idle {
    background: var(--surface-card-soft);
    color: var(--text-tertiary);
  }
}

.master-empty {
  margin-top: 60px;
}

// ============================================================
// 右侧：Detail 排版测试工作台
// ============================================================
.workbench-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--surface-strong);
  overflow-y: auto;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 20px;
}

.detail-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-soft);

  &__info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  &__title {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.3;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 12px;
    color: var(--text-tertiary);
  }

  &__action {
    flex-shrink: 0;
  }
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
}

.detail-style-picker {
  .style-select {
    width: 260px;
  }
}

.typography-playground {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.playground-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.toolbar-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.preset-button {
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: var(--surface-card);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-standard);

  &:hover {
    color: var(--brand-primary);
    border-color: var(--border-brand);
  }

  &--active {
    background: var(--surface-brand-soft);
    color: var(--brand-primary);
    border-color: var(--border-brand);
    font-weight: 600;
  }
}

.toolbar-size {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 140px;

  .size-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    min-width: 36px;
  }

  .size-slider {
    flex: 1;
  }
}

.playground-preview-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--surface-card);
  color: var(--text-primary);
  line-height: 1.6;
}

.preview-headline {
  font-weight: 700;
  line-height: 1.3;
}

.preview-specimen {
  font-size: 12px;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

.preview-paragraph {
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-secondary);
}

.detail-meta-section {
  margin-top: 4px;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.meta-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-card-soft);
  border: 1px solid var(--border-soft);

  &__key {
    font-size: 11px;
    color: var(--text-muted);
  }

  &__val {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.detail-empty {
  margin: auto 0;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;

  .footer-stats {
    font-size: 13px;
    color: var(--text-secondary);

    strong {
      color: var(--brand-primary);
    }
  }

  .footer-actions {
    display: flex;
    gap: 10px;
  }
}
</style>
