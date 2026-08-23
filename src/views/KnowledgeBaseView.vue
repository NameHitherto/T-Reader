<template>
  <div class="knowledge-page">
    <aside class="knowledge-series-panel">
      <div class="panel-header">
        <span class="panel-title">书籍系列</span>
        <el-button size="small" type="primary" text @click="openCreateDialog">新建</el-button>
      </div>

      <div v-if="seriesLoading" class="panel-state">正在加载系列…</div>
      <div v-else-if="series.length === 0" class="panel-state">暂无系列，点击右上角“新建”创建</div>
      <div v-else class="series-list">
        <button
          v-for="item in series"
          :key="item.id"
          type="button"
          class="series-item"
          :class="{ active: item.id === selectedSeriesId }"
          @click="selectSeries(item.id)"
        >
          <span class="series-item__main">
            <span class="series-item__name">{{ item.name }}</span>
            <span class="series-item__meta">
              {{ item.readyDocumentCount }}/{{ item.documentCount }} 本已就绪
            </span>
          </span>
          <span class="series-item__chunks">{{ item.chunkCount }} 块</span>
        </button>
      </div>
    </aside>

    <section v-if="selectedSeries" class="knowledge-workspace">
      <header class="workspace-header">
        <div class="workspace-title">
          <span class="workspace-title__name">{{ selectedSeries.name }}</span>
          <span v-if="selectedSeries.description" class="workspace-title__desc">
            {{ selectedSeries.description }}
          </span>
        </div>
        <div class="workspace-actions">
          <el-button size="small" @click="openEditDialog">编辑系列</el-button>
          <el-button size="small" type="danger" plain @click="confirmDeleteSeries">
            删除系列
          </el-button>
        </div>
      </header>

      <div class="knowledge-columns">
        <section class="documents-column">
          <div class="column-header">
            <span class="column-title">书籍文档</span>
            <el-button size="small" type="primary" :loading="isImporting" @click="importDocuments">
              导入 EPUB
            </el-button>
          </div>

          <div v-if="isImporting || ingestingDocumentIds.size > 0" class="import-progress">
            <el-progress :percentage="overallProgress" :stroke-width="6" :show-text="false" />
            <span>{{ overallStage }}</span>
          </div>

          <div v-if="documentsLoading" class="column-state">正在加载文档…</div>
          <el-empty
            v-else-if="documents.length === 0"
            description="导入多个 EPUB 构建系列知识库"
            :image-size="84"
          />
          <div v-else class="document-list">
            <div v-for="doc in documents" :key="doc.id" class="document-card">
              <div class="document-card__header">
                <span class="document-card__title" :title="doc.title">{{ doc.title }}</span>
                <el-tag :type="statusTagType(doc.status)" size="small" effect="plain" :disable-transitions="true">
                  {{ statusLabel(doc.status) }}
                </el-tag>
              </div>
              <div class="document-card__meta">
                <span>{{ doc.originalFileName }}</span>
                <span>{{ doc.charCount }} 字 · {{ doc.chunkCount }} 块</span>
              </div>
              <div v-if="doc.errorMessage" class="document-card__error">
                {{ doc.errorMessage }}
              </div>
              <div v-if="ingestingDocumentIds.has(doc.id)" class="document-card__progress">
                <el-progress
                  :percentage="ingestProgress.get(doc.id) ?? 0"
                  :stroke-width="6"
                  :show-text="false"
                />
                <span>{{ ingestStage.get(doc.id) ?? '处理中' }}</span>
              </div>
              <div class="document-card__actions">
                <el-button size="small" text @click="reingestDocument(doc)">重新索引</el-button>
                <el-button size="small" text type="danger" @click="confirmDeleteDocument(doc)">
                  删除
                </el-button>
              </div>
            </div>
          </div>
        </section>

        <section class="qa-column">
          <div class="column-header">
            <span class="column-title">系列问答</span>
            <el-button
              size="small"
              text
              :disabled="isStreaming || messages.length === 0"
              @click="clearConversation"
            >
              清空会话
            </el-button>
          </div>

          <div v-if="contextLoading" class="qa-state">正在检查问答条件…</div>
          <div v-else-if="qaContext && !qaContext.available" class="qa-unavailable">
            <p>{{ qaContext.reason }}</p>
            <el-button v-if="hasMissingModel" size="small" @click="goToSettings">
              前往模型设置
            </el-button>
          </div>
          <template v-else>
            <div ref="messageListEl" class="qa-messages">
              <div v-if="messages.length === 0 && !isStreaming" class="qa-state">
                向该系列提问，回答会展示检索到的原文来源。
              </div>
              <div
                v-for="message in messages"
                :key="message.id"
                class="qa-message"
                :class="`qa-message--${message.role}`"
              >
                <div class="qa-bubble">
                  <MarkdownContent v-if="message.role === 'assistant'" :content="message.content" />
                  <template v-else>{{ message.content }}</template>
                </div>
                <div v-if="message.citations.length > 0" class="qa-citations">
                  <div v-for="(citation, index) in message.citations" :key="index" class="citation">
                    <div class="citation__meta">
                      [{{ index + 1 }}] {{ citation.bookTitle }} · {{ citation.chapterTitle }}
                    </div>
                    <div class="citation__content">{{ citation.content }}</div>
                  </div>
                </div>
              </div>
              <div v-if="isStreaming" class="qa-message qa-message--assistant">
                <div class="qa-bubble">
                  <MarkdownContent :content="streamingText || '正在检索并思考…'" />
                </div>
              </div>
            </div>

            <div class="qa-input-row">
              <el-input
                v-model="draft"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 5 }"
                resize="none"
                maxlength="4000"
                show-word-limit
                placeholder="请输入问题，Ctrl + Enter 发送"
                :disabled="inputDisabled"
                @keydown.ctrl.enter.prevent="send"
              />
              <el-button type="primary" :loading="isStreaming" :disabled="!canSend" @click="send">
                发送
              </el-button>
            </div>
          </template>
        </section>
      </div>
    </section>

    <div v-else class="knowledge-empty-workspace">
      <el-empty description="创建或选择一个书籍系列后开始构建知识库" />
    </div>

    <el-dialog
      v-model="seriesDialogVisible"
      :title="editingSeries ? '编辑系列' : '新建系列'"
      width="min(420px, 92vw)"
      :close-on-click-modal="false"
      @closed="resetSeriesDialog"
    >
      <el-form label-position="top">
        <el-form-item label="系列名称" required>
          <el-input v-model="seriesForm.name" maxlength="40" show-word-limit />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="seriesForm.description"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="seriesDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="seriesSaving" @click="saveSeries">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { open } from '@tauri-apps/plugin-dialog'
import type {
  KnowledgeDocument,
  KnowledgeIngestProgressEvent,
  KnowledgeQaContext,
  KnowledgeQaMessage,
  KnowledgeSeries,
} from '@/types/knowledgeBase'
import {
  clearKnowledgeQaMessages,
  createKnowledgeSeries,
  deleteKnowledgeDocument,
  deleteKnowledgeSeries,
  getKnowledgeQaContext,
  importKnowledgeDocuments,
  listKnowledgeDocuments,
  listKnowledgeQaMessages,
  listKnowledgeSeries,
  reingestKnowledgeDocument,
  sendKnowledgeQaMessage,
  updateKnowledgeSeries,
} from '@/services/knowledgeBase'
import { logError } from '@/utils/logger'
import MarkdownContent from '@/components/common/MarkdownContent/index.vue'

const router = useRouter()
const series = ref<KnowledgeSeries[]>([])
const selectedSeriesId = ref<string | null>(null)
const documents = ref<KnowledgeDocument[]>([])
const qaContext = ref<KnowledgeQaContext | null>(null)
const messages = ref<KnowledgeQaMessage[]>([])
const draft = ref('')
const isStreaming = ref(false)
const streamingText = ref('')
const seriesLoading = ref(false)
const documentsLoading = ref(false)
const contextLoading = ref(false)
const isImporting = ref(false)
const ingestingDocumentIds = ref(new Set<string>())
const ingestProgress = ref(new Map<string, number>())
const ingestStage = ref(new Map<string, string>())
const messageListEl = ref<HTMLElement | null>(null)
const seriesDialogVisible = ref(false)
const seriesSaving = ref(false)
const editingSeries = ref<KnowledgeSeries | null>(null)
const seriesForm = ref({ name: '', description: '' })

const selectedSeries = computed(() => {
  return series.value.find((item) => item.id === selectedSeriesId.value) ?? null
})

const canSend = computed(() => {
  return (
    Boolean(selectedSeriesId.value) &&
    qaContext.value?.available === true &&
    !isStreaming.value &&
    draft.value.trim().length > 0
  )
})

const inputDisabled = computed(() => {
  return qaContext.value?.available !== true || isStreaming.value
})

const overallProgress = computed(() => {
  const values = Array.from(ingestProgress.value.values())
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
})

const overallStage = computed(() => {
  return Array.from(ingestStage.value.values())[0] ?? '正在处理'
})

const hasMissingModel = computed(() => {
  if (!qaContext.value) return false
  return (
    !qaContext.value.chatConfigured ||
    !qaContext.value.embeddingConfigured ||
    !qaContext.value.rerankConfigured
  )
})

const statusLabel = (status: KnowledgeDocument['status']) => {
  return {
    pending: '待处理',
    ingesting: '索引中',
    ready: '已就绪',
    error: '失败',
  }[status]
}

const showMessage = (type: 'success' | 'warning' | 'error', message: string) => {
  ElMessage({
    type,
    message,
    offset: 68,
  })
}

const statusTagType = (status: KnowledgeDocument['status']) => {
  return {
    pending: 'info',
    ingesting: 'warning',
    ready: 'success',
    error: 'danger',
  }[status] as 'info' | 'warning' | 'success' | 'danger'
}

const scrollToBottom = async () => {
  await nextTick()
  if (messageListEl.value) {
    messageListEl.value.scrollTop = messageListEl.value.scrollHeight
  }
}

const loadSeries = async () => {
  seriesLoading.value = true
  try {
    series.value = await listKnowledgeSeries()
    if (!selectedSeriesId.value && series.value.length > 0) {
      selectedSeriesId.value = series.value[0].id
    }
    if (
      selectedSeriesId.value &&
      !series.value.some((item) => item.id === selectedSeriesId.value)
    ) {
      selectedSeriesId.value = series.value[0]?.id ?? null
    }
  } catch (error) {
    showMessage('error', String(error))
  } finally {
    seriesLoading.value = false
  }
}

const loadDocuments = async () => {
  if (!selectedSeriesId.value) return
  documentsLoading.value = true
  try {
    documents.value = await listKnowledgeDocuments(selectedSeriesId.value)
  } catch (error) {
    showMessage('error', String(error))
  } finally {
    documentsLoading.value = false
  }
}

const loadContext = async () => {
  if (!selectedSeriesId.value) return
  contextLoading.value = true
  try {
    qaContext.value = await getKnowledgeQaContext(selectedSeriesId.value)
  } catch (error) {
    qaContext.value = null
    showMessage('error', String(error))
  } finally {
    contextLoading.value = false
  }
}

const loadMessages = async () => {
  if (!selectedSeriesId.value) return
  try {
    messages.value = await listKnowledgeQaMessages(selectedSeriesId.value)
    await scrollToBottom()
  } catch (error) {
    showMessage('error', String(error))
  }
}

const selectSeries = (seriesId: string) => {
  if (selectedSeriesId.value === seriesId) return
  selectedSeriesId.value = seriesId
}

watch(selectedSeriesId, () => {
  draft.value = ''
  streamingText.value = ''
  messages.value = []
  qaContext.value = null
  documents.value = []
  if (selectedSeriesId.value) {
    void Promise.all([loadDocuments(), loadContext(), loadMessages()])
  }
})

const openCreateDialog = () => {
  editingSeries.value = null
  seriesForm.value = { name: '', description: '' }
  seriesDialogVisible.value = true
}

const openEditDialog = () => {
  if (!selectedSeries.value) return
  editingSeries.value = selectedSeries.value
  seriesForm.value = {
    name: selectedSeries.value.name,
    description: selectedSeries.value.description,
  }
  seriesDialogVisible.value = true
}

const resetSeriesDialog = () => {
  editingSeries.value = null
  seriesForm.value = { name: '', description: '' }
}

const saveSeries = async () => {
  const name = seriesForm.value.name.trim()
  if (!name) {
    showMessage('warning', '请输入系列名称')
    return
  }

  seriesSaving.value = true
  try {
    if (editingSeries.value) {
      await updateKnowledgeSeries({
        seriesId: editingSeries.value.id,
        name,
        description: seriesForm.value.description.trim(),
      })
      showMessage('success', '系列已更新')
    } else {
      const created = await createKnowledgeSeries({
        name,
        description: seriesForm.value.description.trim(),
      })
      selectedSeriesId.value = created.id
      showMessage('success', '系列已创建')
    }
    seriesDialogVisible.value = false
    await loadSeries()
  } catch (error) {
    showMessage('error', String(error))
  } finally {
    seriesSaving.value = false
  }
}

const confirmDeleteSeries = async () => {
  if (!selectedSeries.value) return
  try {
    await ElMessageBox.confirm(
      `删除系列“${selectedSeries.value.name}”会同时删除其文档、向量和问答记录，是否继续？`,
      '删除系列',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  try {
    await deleteKnowledgeSeries(selectedSeries.value.id)
    selectedSeriesId.value = null
    await loadSeries()
    showMessage('success', '系列已删除')
  } catch (error) {
    showMessage('error', String(error))
  }
}

const importDocuments = async () => {
  if (!selectedSeriesId.value) return

  let selected: string | string[] | null
  try {
    selected = await open({
      multiple: true,
      directory: false,
      filters: [{ name: 'EPUB', extensions: ['epub'] }],
    })
  } catch (error) {
    showMessage('error', String(error))
    return
  }

  const filePaths = selected
    ? (Array.isArray(selected) ? selected : [selected]).filter(Boolean)
    : []
  if (filePaths.length === 0) return

  const seriesId = selectedSeriesId.value
  isImporting.value = true
  try {
    const imported = await importKnowledgeDocuments(seriesId, filePaths, (event) => {
      handleIngestProgress(event)
    })
    showMessage('success', `已完成 ${imported.length} 个文件导入`)
    await Promise.all([loadSeries(), loadDocuments(), loadContext()])
  } catch (error) {
    logError('knowledge-base', 'import-documents failed', error)
    showMessage('error', String(error))
    await Promise.all([loadSeries(), loadDocuments(), loadContext()])
  } finally {
    isImporting.value = false
  }
}

const handleIngestProgress = (event: KnowledgeIngestProgressEvent) => {
  if (event.stage === 'done' || event.stage === 'error') {
    ingestingDocumentIds.value.delete(event.documentId)
    ingestProgress.value.delete(event.documentId)
    ingestStage.value.delete(event.documentId)
  } else {
    ingestingDocumentIds.value.add(event.documentId)
    ingestStage.value.set(event.documentId, event.message)
    if (event.totalChunks > 0) {
      ingestProgress.value.set(
        event.documentId,
        Math.round((event.processedChunks / event.totalChunks) * 100),
      )
    }
  }

  const document = documents.value.find((item) => item.id === event.documentId)
  if (document) {
    if (event.stage === 'done') {
      document.status = 'ready'
      document.chunkCount = event.totalChunks
    } else if (event.stage === 'error') {
      document.status = 'error'
      document.errorMessage = event.message
    } else {
      document.status = 'ingesting'
    }
  }
}

const reingestDocument = async (document: KnowledgeDocument) => {
  try {
    await ElMessageBox.confirm(`重新索引《${document.title}》？`, '重新索引', {
      type: 'info',
    })
  } catch {
    return
  }

  ingestingDocumentIds.value.add(document.id)
  try {
    await reingestKnowledgeDocument(document.id, (event) => {
      handleIngestProgress(event)
    })
    showMessage('success', '重新索引完成')
    await Promise.all([loadSeries(), loadDocuments(), loadContext()])
  } catch (error) {
    showMessage('error', String(error))
    await Promise.all([loadSeries(), loadDocuments(), loadContext()])
  } finally {
    ingestingDocumentIds.value.delete(document.id)
    ingestProgress.value.delete(document.id)
    ingestStage.value.delete(document.id)
  }
}

const confirmDeleteDocument = async (document: KnowledgeDocument) => {
  try {
    await ElMessageBox.confirm(`删除《${document.title}》及其全部向量索引？`, '删除文档', {
      type: 'warning',
    })
  } catch {
    return
  }

  try {
    await deleteKnowledgeDocument(document.id)
    showMessage('success', '文档已删除')
    await Promise.all([loadSeries(), loadDocuments(), loadContext()])
  } catch (error) {
    showMessage('error', String(error))
  }
}

const send = async () => {
  const seriesId = selectedSeriesId.value
  if (!seriesId || !canSend.value) return

  const content = draft.value.trim()
  draft.value = ''
  messages.value.push({
    id: `local-${Date.now()}`,
    seriesId,
    role: 'user',
    content,
    citations: [],
    providerType: '',
    modelId: '',
    createdAt: new Date().toISOString(),
  })
  isStreaming.value = true
  streamingText.value = ''
  await scrollToBottom()

  try {
    await sendKnowledgeQaMessage(seriesId, content, (text) => {
      streamingText.value += text
      void scrollToBottom()
    })
    messages.value = await listKnowledgeQaMessages(seriesId)
    await scrollToBottom()
  } catch (error) {
    logError('knowledge-base', 'send-message failed', error)
    showMessage('error', String(error))
    messages.value = await listKnowledgeQaMessages(seriesId)
  } finally {
    isStreaming.value = false
    streamingText.value = ''
  }
}

const clearConversation = async () => {
  if (!selectedSeriesId.value) return
  try {
    await ElMessageBox.confirm('清空该系列的问答历史？', '清空会话', { type: 'warning' })
  } catch {
    return
  }

  try {
    await clearKnowledgeQaMessages(selectedSeriesId.value)
    messages.value = []
    showMessage('success', '会话已清空')
  } catch (error) {
    showMessage('error', String(error))
  }
}

const goToSettings = () => {
  void router.push({ path: '/settings', query: { module: 'aiModels' } })
}

onMounted(async () => {
  await loadSeries()
})
</script>

<style scoped lang="scss">
.knowledge-page {
  display: flex;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--text-primary);
  background: var(--app-bg-accent);
}

.knowledge-series-panel {
  display: flex;
  flex: 0 0 250px;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: var(--surface-strong);
  border-right: 1px solid var(--border-soft);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 14px 10px;
}

.panel-title {
  font-size: 14px;
  font-weight: 700;
}

.panel-state {
  padding: 24px 16px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.series-list {
  flex: 1;
  min-height: 0;
  padding: 0 8px 16px;
  overflow-y: auto;
}

.series-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
  padding: 10px;
  margin-bottom: 6px;
  color: var(--text-secondary);
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;

  &:hover {
    background: var(--surface-brand-soft);
    border-color: var(--border-brand);
  }

  &.active {
    color: var(--brand-primary);
    background: var(--surface-brand-soft);
    border-color: var(--border-brand);
  }
}

.series-item__main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.series-item__name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.series-item__meta,
.series-item__chunks {
  color: var(--text-tertiary);
  font-size: 12px;
  white-space: nowrap;
}

.knowledge-workspace {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  padding: 16px 20px 20px;
}

.workspace-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.workspace-title {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.workspace-title__name {
  font-size: 20px;
  font-weight: 700;
}

.workspace-title__desc {
  color: var(--text-tertiary);
  font-size: 13px;
}

.workspace-actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

.knowledge-columns {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(260px, 0.8fr) minmax(380px, 1.2fr);
  gap: 14px;
}

.documents-column,
.qa-column {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding: 14px;
  overflow: hidden;
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-xs);
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.column-title {
  font-size: 15px;
  font-weight: 700;
}

.column-state,
.qa-state {
  padding: 24px 0;
  color: var(--text-tertiary);
  font-size: 13px;
  text-align: center;
}

.import-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0 12px;
  color: var(--text-tertiary);
  font-size: 12px;

  :deep(.el-progress) {
    flex: 1;
  }
}

.document-list,
.qa-messages {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
}

.document-card {
  padding: 12px;
  margin-bottom: 10px;
  background: var(--surface-card-muted);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
}

.document-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.document-card__title {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-card__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 6px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.document-card__error {
  margin-top: 8px;
  color: var(--text-danger);
  font-size: 12px;
}

.document-card__progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  color: var(--text-tertiary);
  font-size: 12px;

  :deep(.el-progress) {
    flex: 1;
  }
}

.document-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 8px;
}

.qa-unavailable {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);
}

.qa-message {
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;

  &--user {
    align-items: flex-end;

    .qa-bubble {
      color: var(--text-on-brand);
      background: var(--brand-primary);
    }
  }

  &--assistant {
    align-items: flex-start;

    .qa-bubble {
      background: var(--surface-inset);
    }
  }
}

.qa-bubble {
  max-width: 82%;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  border-radius: 12px;
}

.qa-citations {
  width: 100%;
  margin-top: 8px;
}

.citation {
  padding: 8px 10px;
  margin-bottom: 6px;
  background: var(--surface-card-muted);
  border-left: 3px solid var(--border-brand);
  border-radius: var(--radius-sm);
}

.citation__meta {
  margin-bottom: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.citation__content {
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.55;
}

.qa-input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-soft);

  :deep(.el-textarea) {
    flex: 1;
  }
}

.knowledge-empty-workspace {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
}

@media (max-width: 1100px) {
  .knowledge-series-panel {
    flex-basis: 200px;
  }

  .knowledge-workspace {
    padding: 14px 14px 16px;
  }

  .knowledge-columns {
    grid-template-columns: minmax(220px, 0.9fr) minmax(300px, 1.1fr);
    gap: 12px;
  }
}

@media (max-width: 880px) {
  .knowledge-page {
    flex-direction: column;
    overflow-y: auto;
  }

  .knowledge-series-panel {
    flex: none;
    border-right: none;
    border-bottom: 1px solid var(--border-soft);
  }

  .panel-header {
    padding: 12px 14px 8px;
  }

  .series-list {
    display: flex;
    gap: 8px;
    padding: 0 14px 12px;
    overflow: auto hidden;
  }

  .series-item {
    flex: 0 0 180px;
    margin-bottom: 0;
  }

  .knowledge-workspace {
    flex: none;
    overflow: visible;
  }

  .workspace-header {
    flex-wrap: wrap;
  }

  .knowledge-columns {
    grid-template-columns: 1fr;
  }

  .documents-column,
  .qa-column {
    overflow: visible;
  }

  .document-list {
    overflow: visible;
  }

  .qa-messages {
    min-height: 260px;
    max-height: 55vh;
  }
}
</style>
