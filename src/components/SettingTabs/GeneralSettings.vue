<template>
  <div class="general-settings">
    <!-- 界面主题 -->
    <section class="setting-group">
      <h3 class="setting-group__title">界面主题</h3>
      <div class="setting-card">
        <div class="setting-item">
          <div class="setting-item__info">
            <span class="setting-item__title">黑夜模式</span>
            <span class="setting-item__subtitle">开启后切换为深色视觉主题</span>
          </div>
          <el-switch
            :model-value="themeMode === 'dark'"
            class="theme-switch"
            :aria-label="themeMode === 'dark' ? '切换到白天模式' : '切换到黑夜模式'"
            @change="onThemeSwitchChange"
          >
            <template #active-action>
              <AppIcon name="moon" :size="14" />
            </template>
            <template #inactive-action>
              <AppIcon name="sun" :size="14" />
            </template>
          </el-switch>
        </div>
      </div>
    </section>

    <!-- 第三方字体 -->
    <section class="setting-group font-setting-group">
      <div class="font-group-header">
        <div class="font-group-header__info">
          <h3 class="setting-group__title">第三方字体</h3>
          <span class="font-group-subtitle"> 管理已启用的系统字体与书籍内置字体 </span>
        </div>

        <!-- 顶部操作按钮（参考设计布局） -->
        <div class="font-group-header__actions">
          <el-button class="font-header-btn" @click="extractDialogVisible = true">
            <AppIcon name="bookOpen" :size="15" />
            <span>解析书籍内置字体</span>
          </el-button>
          <el-button class="font-header-btn" @click="selectDialogVisible = true">
            <AppIcon name="setting" :size="15" />
            <span>选择系统字体</span>
          </el-button>
        </div>
      </div>

      <!-- 字体卡片列表（参考设计卡片布局） -->
      <div v-if="fontCards.length > 0" class="font-card-list">
        <article v-for="item in fontCards" :key="item.id" class="font-card">
          <!-- 左侧：图标与信息 -->
          <div class="font-card__main">
            <div class="font-card__glyph" :style="{ fontFamily: item.previewFamilyCss }">Aa</div>

            <div class="font-card__details">
              <div class="font-card__title-row">
                <span class="font-card__title" :title="item.displayFamily">
                  {{ item.displayFamily }}
                </span>
                <span
                  class="font-card__badge"
                  :class="
                    item.type === 'system'
                      ? 'font-card__badge--system'
                      : 'font-card__badge--imported'
                  "
                >
                  {{ item.type === 'system' ? '系统' : '内置' }}
                </span>
              </div>

              <div
                class="font-card__meta"
                :title="`${item.subfamily || item.fullName || 'Regular'} · 字重 ${item.weight || 400} · ${item.sourceText}`"
              >
                <span class="meta-part">{{ item.subfamily || item.fullName || 'Regular' }}</span>
                <span class="meta-dot">·</span>
                <span class="meta-part">字重 {{ item.weight || 400 }}</span>
                <span class="meta-dot">·</span>
                <span class="meta-part">{{ item.sourceText }}</span>
              </div>
            </div>
          </div>

          <!-- 中部：实时字形排版预览 -->
          <div class="font-card__preview" :style="{ fontFamily: item.previewFamilyCss }">
            <span class="preview-text">洛琪希 赛高！ Roxy Forever 123 永和九年</span>
          </div>

          <!-- 右侧：悬浮删除/不启用按钮 -->
          <div class="font-card__actions">
            <el-tooltip
              v-if="item.type === 'system'"
              content="不启用"
              placement="top"
              :show-after="200"
            >
              <button
                type="button"
                class="card-action-btn card-action-btn--delete"
                aria-label="不启用"
                @click.stop="handleDisableSystemFont(item.systemFont!)"
              >
                <AppIcon name="delete" :size="16" />
              </button>
            </el-tooltip>

            <el-tooltip v-else content="删除" placement="top" :show-after="200">
              <button
                type="button"
                class="card-action-btn card-action-btn--delete"
                aria-label="删除"
                @click.stop="handleDeleteImportedFont(item.filename!)"
              >
                <AppIcon name="delete" :size="16" />
              </button>
            </el-tooltip>
          </div>
        </article>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!loadingFonts" class="font-empty-card">
        <el-empty
          description="暂无启用的第三方字体，可点击右上角按钮解析书籍内置字体或选择系统字体"
          :image-size="80"
        />
      </div>
    </section>

    <!-- 弹窗组件 -->
    <ExtractBookFontDialog v-model="extractDialogVisible" @extracted="loadAllFonts" />
    <SystemFontSelectDialog
      v-model="selectDialogVisible"
      :current-enabled-fonts="enabledSystemFonts"
      @save="handleSaveSystemFonts"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '@/components/common/AppIcon/index.vue'
import ExtractBookFontDialog from '@/components/ExtractBookFontDialog/index.vue'
import SystemFontSelectDialog from '@/components/SystemFontSelectDialog/index.vue'
import { useSettingsCenter } from '@/composables/useSettingsCenter'
import {
  disableSystemFont,
  getReaderFontValue,
  getSystemFontEntryKey,
  loadEnabledSystemFonts,
  persistEnabledSystemFonts,
} from '@/services/reader/systemFonts'
import {
  deleteLocalFont,
  refreshLocalFontCatalog,
  getLocalFontUrl,
  parseBookFontValue,
} from '@/services/reader/localFonts'
import { updateReaderConfig } from '@/services/reader/config'
import {
  buildLocalSrcValue,
  escapeCssString,
  getReaderLocalFontCandidates,
} from '@/services/reader/fontApplication'
import {
  DEFAULT_READER_FONT,
  type EnabledSystemFont,
  type LocalFontEntry,
} from '@/services/reader/fontTypes'
import { ElMessage } from 'element-plus'

interface ThirdPartyFontCardItem {
  id: string
  type: 'system' | 'imported'
  family: string
  displayFamily: string
  subfamily: string | null
  fullName: string | null
  postscriptName: string | null
  weight: number | null
  sourceText: string
  previewFamilyName: string
  previewFamilyCss: string
  systemFont?: EnabledSystemFont
  filename?: string
  rawLocalFont?: LocalFontEntry
}

const PREVIEW_STYLE_TAG_ID = 'general-settings-font-preview-styles'

const { themeMode } = useSettingsCenter()

const loadingFonts = ref(false)
const extractDialogVisible = ref(false)
const selectDialogVisible = ref(false)

const enabledSystemFonts = ref<EnabledSystemFont[]>([])
const importedFonts = ref<LocalFontEntry[]>([])

const onThemeSwitchChange = (value: string | number | boolean) => {
  themeMode.value = value ? 'dark' : 'light'
}

const fontCards = computed<ThirdPartyFontCardItem[]>(() => {
  const cards: ThirdPartyFontCardItem[] = []

  // 1. 用户已启用的系统字体
  enabledSystemFonts.value.forEach((font, idx) => {
    const previewFamilyName = `TReaderSysFont-${idx}`

    cards.push({
      id: `sys-${getSystemFontEntryKey(font)}`,
      type: 'system',
      family: font.family,
      displayFamily: font.displayFamily || font.family,
      subfamily: font.subfamily,
      fullName: font.fullName,
      postscriptName: font.postscriptName,
      weight: font.weight,
      sourceText: font.path ? '系统字体文件' : '系统注册字体',
      previewFamilyName,
      previewFamilyCss: `"${escapeCssString(previewFamilyName)}", ${DEFAULT_READER_FONT}`,
      systemFont: font,
    })
  })

  // 2. 导入的书籍内部字体
  importedFonts.value.forEach((font, idx) => {
    const previewFamilyName = `TReaderImpFont-${idx}`

    cards.push({
      id: `imp-${font.filename}-${font.faceIndex}`,
      type: 'imported',
      family: font.family,
      displayFamily: font.displayFamily || font.family,
      subfamily: font.subfamily,
      fullName: font.fullName,
      postscriptName: font.postscriptName,
      weight: font.weight,
      sourceText: `书籍内置: ${font.filename}`,
      previewFamilyName,
      previewFamilyCss: `"${escapeCssString(previewFamilyName)}", ${DEFAULT_READER_FONT}`,
      filename: font.filename,
      rawLocalFont: font,
    })
  })

  return cards
})

// 动态注入字体卡片真实排版字形的 @font-face 样式规则
const syncPreviewStyles = () => {
  const existing = document.getElementById(PREVIEW_STYLE_TAG_ID) as HTMLStyleElement | null

  if (fontCards.value.length === 0) {
    existing?.remove()
    return
  }

  const rules: string[] = []

  for (const card of fontCards.value) {
    if (card.type === 'system' && card.systemFont) {
      const candidates = getReaderLocalFontCandidates(
        card.systemFont,
        getReaderFontValue(card.systemFont),
      )

      if (candidates.length > 0) {
        rules.push(
          `@font-face { font-family: "${escapeCssString(card.previewFamilyName)}"; src: ${buildLocalSrcValue(candidates)}; font-display: swap; }`,
        )
      }
    } else if (card.type === 'imported' && card.rawLocalFont) {
      const url = getLocalFontUrl(card.rawLocalFont)

      rules.push(
        `@font-face { font-family: "${escapeCssString(card.previewFamilyName)}"; src: url("${url}"); font-display: swap; }`,
      )
    }
  }

  const combinedRules = rules.join('\n')
  const styleEl = existing || document.createElement('style')
  styleEl.id = PREVIEW_STYLE_TAG_ID

  if (styleEl.textContent !== combinedRules) {
    styleEl.textContent = combinedRules
  }

  if (!styleEl.isConnected) {
    document.head.appendChild(styleEl)
  }
}

const removePreviewStyles = () => {
  document.getElementById(PREVIEW_STYLE_TAG_ID)?.remove()
}

watch(fontCards, syncPreviewStyles, { immediate: true })
onBeforeUnmount(removePreviewStyles)

const loadAllFonts = async () => {
  loadingFonts.value = true

  try {
    const [sysFonts, localResult] = await Promise.all([
      loadEnabledSystemFonts().catch(() => []),
      refreshLocalFontCatalog().catch(() => ({ fonts: [], warnings: [] })),
    ])

    enabledSystemFonts.value = sysFonts
    importedFonts.value = localResult.fonts
  } finally {
    loadingFonts.value = false
  }
}

const FONT_NOTIFICATION_OFFSET = 60

const handleDisableSystemFont = async (font: EnabledSystemFont) => {
  try {
    await disableSystemFont(font)
    ElMessage.success({
      message: `已取消启用系统字体「${font.displayFamily || font.family}」`,
      offset: FONT_NOTIFICATION_OFFSET,
    })
    await loadAllFonts()
  } catch (error) {
    ElMessage.error({
      message: `取消启用失败: ${String(error)}`,
      offset: FONT_NOTIFICATION_OFFSET,
    })
  }
}

const handleDeleteImportedFont = async (filename: string) => {
  try {
    const res = await deleteLocalFont(filename)

    if (res.deleted) {
      ElMessage.success({
        message: '已删除导入的字体文件',
        offset: FONT_NOTIFICATION_OFFSET,
      })
    } else {
      ElMessage.info({
        message: '字体文件已不存在',
        offset: FONT_NOTIFICATION_OFFSET,
      })
    }

    await updateReaderConfig((currentConfig) => {
      const parsed = parseBookFontValue(currentConfig.font)
      if (
        (parsed && parsed.filename.toLowerCase() === filename.toLowerCase()) ||
        currentConfig.font.toLowerCase() === filename.toLowerCase()
      ) {
        return { font: DEFAULT_READER_FONT }
      }
      return null
    })

    await loadAllFonts()
  } catch (error) {
    ElMessage.error({
      message: `删除字体失败: ${String(error)}`,
      offset: FONT_NOTIFICATION_OFFSET,
    })
  }
}

const handleSaveSystemFonts = async (nextFonts: EnabledSystemFont[]) => {
  try {
    await persistEnabledSystemFonts(nextFonts)
    ElMessage.success({
      message: '系统字体设置已保存',
      offset: FONT_NOTIFICATION_OFFSET,
    })
    await loadAllFonts()
  } catch (error) {
    ElMessage.error({
      message: `保存字体设置失败: ${String(error)}`,
      offset: FONT_NOTIFICATION_OFFSET,
    })
  }
}

onMounted(() => {
  void loadAllFonts()
})
</script>

<style scoped lang="scss">
@use '@/styles/components/setting-tab';

.general-settings {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

// 主题 Switch（基于 el-switch，带日/月图标）
.theme-switch {
  --el-switch-on-color: var(--brand-primary);
  --el-switch-off-color: var(--surface-inset);
  flex-shrink: 0;

  :deep(.el-switch__core) {
    min-width: 48px;
    height: 26px;
    border-radius: var(--radius-pill);
  }

  :deep(.el-switch__action) {
    width: 22px;
    height: 22px;
    background: #ffffff;
    color: var(--brand-secondary);
    box-shadow: var(--shadow-sm);
  }

  &.is-checked :deep(.el-switch__action) {
    left: calc(100% - 23px);
    color: var(--brand-primary);
  }
}

// 第三方字体板块
.font-setting-group {
  .font-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;

    &__info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    &__actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;

      .font-header-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    }
  }

  .setting-group__title {
    margin: 0;
  }

  .font-group-subtitle {
    font-size: 12px;
    color: var(--text-tertiary);
    line-height: 1.4;
  }
}

// 字体卡片列表（横向单条卡片）
.font-card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.font-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  box-shadow: var(--shadow-xs);
  transition:
    background-color var(--duration-fast) var(--easing-standard),
    border-color var(--duration-fast) var(--easing-standard),
    box-shadow var(--duration-fast) var(--easing-standard);

  &:hover {
    background: var(--surface-card-soft);
    border-color: var(--border-brand);
    box-shadow: var(--shadow-sm);

    .font-card__actions {
      opacity: 1;
      visibility: visible;
      transform: translateX(0);
    }
  }

  &:focus-within {
    .font-card__actions {
      opacity: 1;
      visibility: visible;
      transform: translateX(0);
    }
  }

  &__main {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 220px;
    max-width: 320px;
    flex-shrink: 0;
  }

  &__glyph {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    background: var(--surface-card-soft);
    border: 1px solid var(--border-soft);
    color: var(--brand-primary);
    font-size: 16px;
    font-weight: 700;
  }

  &__details {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  &__title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.4;
    white-space: nowrap;
    flex-shrink: 0;

    &--system {
      background: var(--surface-brand-soft);
      color: var(--brand-primary);
      border: 1px solid var(--border-brand);
    }

    &--imported {
      background: rgba(16, 185, 129, 0.12);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    .meta-part {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .meta-dot {
      color: var(--text-muted);
      flex-shrink: 0;
    }
  }

  // 中部排版预览
  &__preview {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    padding: 0 16px;
    color: var(--text-secondary);
    text-align: center;
    overflow: hidden;

    .preview-text {
      font-size: 15px;
      line-height: 1.4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  // 右侧悬浮操作按钮（默认隐藏，鼠标悬浮卡片后平滑滑入）
  &__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-shrink: 0;
    min-width: 32px;
    opacity: 0;
    visibility: hidden;
    transform: translateX(6px);
    transition: all var(--duration-fast) var(--easing-standard);
  }
}

.card-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-standard);

  &--delete {
    color: #f56c6c;

    &:hover {
      background: rgba(245, 108, 108, 0.12);
      border-color: rgba(245, 108, 108, 0.25);
    }
  }
}

.font-empty-card {
  padding: 32px 16px;
  border: 1px dashed var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--surface-card);
}
</style>
