<template>
  <el-dialog
    :model-value="modelValue"
    align-center
    append-to-body
    class="assistant-dialog-wrapper"
    :close-on-click-modal="!isStreaming"
    :close-on-press-escape="!isStreaming"
    :show-close="false"
    width="min(1120px, calc(100vw - 40px))"
    @open="handleOpen"
    @closed="handleClosed"
    @update:model-value="handleVisibilityChange"
  >
    <div class="assistant-workspace">
      <aside class="assistant-rail">
        <div class="assistant-brand">
          <img class="assistant-avatar" :src="faviconImg" alt="T-Reader assistant" />
          <div class="assistant-brand-copy">
            <div class="assistant-title">阅读助手</div>
            <div class="assistant-subtitle">{{ statusText }}</div>
          </div>
        </div>

        <div class="rail-section rail-section--context">
          <div class="rail-label">当前上下文</div>
          <div class="context-meter">
            <span class="context-dot" :class="{ 'is-active': Boolean(bookContext) }" />
            <span>{{ contextStatusText }}</span>
          </div>
          <div class="context-stats">
            <div>
              <span class="stat-value">{{ messageCount }}</span>
              <span class="stat-label">轮对话</span>
            </div>
            <div>
              <span class="stat-value">{{ contextSizeLabel }}</span>
              <span class="stat-label">上下文</span>
            </div>
          </div>
        </div>

        <div class="rail-section">
          <div class="rail-label">快捷提问</div>
          <button
            v-for="prompt in quickPrompts"
            :key="prompt"
            class="prompt-chip"
            :disabled="!canUsePrompt"
            @click="sendPresetPrompt(prompt)"
          >
            <span>{{ prompt }}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </button>
        </div>

        <div class="rail-actions">
          <button
            class="rail-icon-button"
            type="button"
            title="新对话"
            aria-label="新对话"
            :disabled="isStreaming"
            @click="resetConversation"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            class="rail-icon-button"
            type="button"
            title="关闭"
            aria-label="关闭"
            :disabled="isStreaming"
            @click="closeDialog"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </aside>

      <main class="assistant-main">
        <header class="conversation-topbar">
          <div>
            <div class="topbar-kicker">BOOK CHAT</div>
            <h2>和当前书籍对话</h2>
          </div>
          <div class="topbar-status" :class="{ 'is-streaming': isStreaming }">
            <span class="status-pulse" />
            <span>{{ composerHint }}</span>
          </div>
        </header>

        <section v-if="contextError" class="assistant-state assistant-state--error">
          <div class="state-title">无法准备书籍上下文</div>
          <div class="state-text">{{ contextError }}</div>
          <el-button type="primary" @click="loadBookContext">重新加载</el-button>
        </section>

        <section v-else class="conversation-panel">
          <el-scrollbar ref="scrollbarRef" class="assistant-scrollbar">
            <div v-if="messages.length === 0" class="assistant-empty">
              <div class="empty-orbit">
                <span />
                <span />
                <span />
              </div>
              <div class="empty-title">从一个问题开始</div>
              <div class="empty-text">选择左侧问题，或直接输入你想追问的内容。</div>
            </div>

            <div v-else class="message-list">
              <article
                v-for="message in messages"
                :key="message.id"
                class="message-row"
                :class="`message-row--${message.role}`"
              >
                <div v-if="message.role === 'assistant'" class="assistant-mark">
                  <img :src="faviconImg" alt="assistant" />
                </div>
                <div
                  class="message-card"
                  :class="{
                    'message-card--error': message.status === 'error',
                    'message-card--streaming': message.status === 'streaming',
                  }"
                >
                  <div class="message-author">
                    {{ message.role === 'assistant' ? 'T-Reader' : '你' }}
                  </div>
                  <div
                    v-if="message.role === 'assistant'"
                    class="message-content markdown-body"
                    v-html="renderMarkdown(message.content)"
                  />
                  <div v-else class="message-content">{{ message.content }}</div>
                  <div v-if="message.status === 'streaming'" class="message-meta">
                    <span class="typing-bars"><i /><i /><i /></span>
                    正在生成
                  </div>
                  <div v-else-if="message.status === 'stopped'" class="message-meta">
                    已停止生成
                  </div>
                  <div
                    v-else-if="message.status === 'error'"
                    class="message-meta message-meta--error"
                  >
                    请求失败
                  </div>
                </div>
              </article>
            </div>
          </el-scrollbar>

          <footer class="assistant-composer">
            <div class="composer-field">
              <el-input
                v-model="inputMessage"
                type="textarea"
                resize="none"
                placeholder="向当前书籍提问..."
                :autosize="{ minRows: 2, maxRows: 6 }"
                :disabled="isPreparingContext"
                @keydown.enter="handleInputEnter"
              />
            </div>
            <button
              v-if="isStreaming"
              class="composer-action composer-action--danger"
              type="button"
              aria-label="停止生成"
              title="停止生成"
              @click="stopStreaming"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 8h8v8H8z" />
              </svg>
            </button>
            <button
              v-else
              class="composer-action"
              type="button"
              aria-label="发送"
              title="发送"
              :disabled="!canSend"
              @click="sendMessage"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </button>
          </footer>
        </section>
      </main>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import MarkdownIt from 'markdown-it/index'
import hljs from 'highlight.js'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import favicon from '@/assets/images/roxy.png'
import {
  createAssistantRequestId,
  createAssistantStream,
  type AssistantStreamController,
} from '@/services/assistant/assistantChatService'
import { extractBookContent } from '@/services/book/bookContentService'
import { getChatProvider, loadAppSettings } from '@/services/settings/appSettingsService'
import { logError } from '@/utils/logger'
import type { AssistantChatMessage, AssistantChatRole } from '@/types/assistant'

interface UiAssistantMessage {
  id: string
  role: AssistantChatRole
  content: string
  status?: 'streaming' | 'stopped' | 'error'
}

const props = defineProps<{
  modelValue: boolean
  bookKey: string | null
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>()

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  highlight: (str: string, lang: string): string => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre><code class="hljs">${
          hljs.highlight(str, {
            language: lang,
            ignoreIllegals: true,
          }).value
        }</code></pre>`
      } catch (error) {
        logError('assistant', '代码高亮失败', error)
      }
    }

    return `<pre><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`
  },
})

const HISTORY_CONTEXT_LIMIT = 12

const faviconImg = favicon
const scrollbarRef = ref<{ setScrollTop: (top: number) => void } | null>(null)
const inputMessage = ref('')
const messages = ref<UiAssistantMessage[]>([])
const bookContext = ref('')
const loadedBookKey = ref<string | null>(null)
const contextError = ref('')
const isPreparingContext = ref(false)
const isStreaming = ref(false)
const chatConfigured = ref(false)
const activeController = ref<AssistantStreamController | null>(null)
const activeRequestId = ref('')

const quickPrompts = [
  '概括这一部分的核心内容',
  '梳理主要人物关系',
  '解释一个我可能忽略的细节',
  '列出值得继续追问的问题',
]

const messageCount = computed(
  () => messages.value.filter((message) => message.role === 'user').length,
)

const contextSizeLabel = computed(() => {
  if (!bookContext.value) {
    return '0'
  }
  return `${Math.max(1, Math.round(bookContext.value.length / 1000))}k`
})

const contextStatusText = computed(() => {
  if (isPreparingContext.value) {
    return '正在读取'
  }
  if (contextError.value) {
    return '读取失败'
  }
  if (!chatConfigured.value) {
    return '模型未配置'
  }
  return bookContext.value ? '已就绪' : '待加载'
})

const statusText = computed(() => {
  if (isPreparingContext.value) {
    return '正在读取当前书籍上下文'
  }
  if (isStreaming.value) {
    return '正在生成回复'
  }
  if (contextError.value) {
    return '上下文准备失败'
  }
  if (!chatConfigured.value) {
    return '尚未配置对话模型'
  }
  return bookContext.value ? '已连接当前书籍上下文' : '等待提问'
})

const composerHint = computed(() => {
  if (!chatConfigured.value) {
    return '请先配置 AI 对话模型'
  }
  if (isPreparingContext.value) {
    return '正在准备书籍内容'
  }
  if (isStreaming.value) {
    return '生成中'
  }
  return '上下文已就绪'
})

const canSend = computed(() => {
  return (
    Boolean(inputMessage.value.trim()) &&
    Boolean(bookContext.value) &&
    chatConfigured.value &&
    !isPreparingContext.value &&
    !isStreaming.value
  )
})

const canUsePrompt = computed(() => {
  return (
    Boolean(bookContext.value) &&
    chatConfigured.value &&
    !isPreparingContext.value &&
    !isStreaming.value
  )
})

const nextMessageId = () => `message-${Date.now()}-${Math.random().toString(16).slice(2)}`

const renderMarkdown = (content: string) => md.render(content || '')

const scrollToBottom = () => {
  nextTick(() => {
    scrollbarRef.value?.setScrollTop(999999)
  })
}

watch(
  messages,
  () => {
    scrollToBottom()
  },
  { deep: true },
)

const toChatMessages = (): AssistantChatMessage[] => {
  return messages.value
    .filter((message) => message.content.trim() && message.status !== 'error')
    .slice(-HISTORY_CONTEXT_LIMIT)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }))
}

const buildSystemPrompt = () => {
  return [
    '你是 T-Reader 的阅读对话助手。',
    '用户正在阅读一本书，优先基于下方书籍原文片段回答。',
    '如果原文片段不足以回答，请明确说明依据不足，并给出谨慎推断。',
    '回答应清晰、简洁、直接。',
    '',
    '书籍原文片段：',
    bookContext.value,
  ].join('\n')
}

const loadChatConfig = async () => {
  const settings = await loadAppSettings()
  const chatProvider = getChatProvider(settings)
  chatConfigured.value = Boolean(
    chatProvider?.modelId && chatProvider.baseUrl && chatProvider.endpoint,
  )
}

const loadBookContext = async () => {
  if (!props.bookKey) {
    contextError.value = '当前没有可用于对话的书籍。'
    return
  }

  isPreparingContext.value = true
  contextError.value = ''
  chatConfigured.value = false

  try {
    await loadChatConfig()
    bookContext.value = await extractBookContent(props.bookKey)
    loadedBookKey.value = props.bookKey
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    contextError.value = message || '读取书籍内容失败'
    logError('assistant', '读取书籍上下文失败', error)
  } finally {
    isPreparingContext.value = false
  }
}

const ensureReady = async () => {
  await loadChatConfig()
  if (props.bookKey !== loadedBookKey.value || !bookContext.value) {
    await loadBookContext()
  }
}

const finalizeAssistantMessage = (
  assistantMessage: UiAssistantMessage,
  status?: UiAssistantMessage['status'],
) => {
  assistantMessage.status = status
  isStreaming.value = false
  activeController.value = null
  activeRequestId.value = ''
}

const submitMessage = async (content: string) => {
  const normalizedContent = content.trim()
  if (!normalizedContent || isStreaming.value) {
    return
  }

  await ensureReady()
  if (!canSend.value && normalizedContent === inputMessage.value.trim()) {
    return
  }
  if (!bookContext.value || !chatConfigured.value || isPreparingContext.value) {
    return
  }

  const userMessage: UiAssistantMessage = {
    id: nextMessageId(),
    role: 'user',
    content: normalizedContent,
  }
  const assistantMessage: UiAssistantMessage = {
    id: nextMessageId(),
    role: 'assistant',
    content: '',
    status: 'streaming',
  }

  messages.value.push(userMessage, assistantMessage)
  inputMessage.value = ''
  isStreaming.value = true

  const requestId = createAssistantRequestId()
  activeRequestId.value = requestId
  const controller = createAssistantStream({
    requestId,
    systemPrompt: buildSystemPrompt(),
    messages: toChatMessages(),
    onDelta: (text) => {
      assistantMessage.content += text
    },
    onDone: () => {
      assistantMessage.status = undefined
      finalizeAssistantMessage(assistantMessage)
    },
    onError: (message) => {
      assistantMessage.content = assistantMessage.content || `请求失败：${message}`
      finalizeAssistantMessage(assistantMessage, 'error')
    },
    onCancelled: () => {
      assistantMessage.content = assistantMessage.content || '已停止生成。'
      finalizeAssistantMessage(assistantMessage, 'stopped')
    },
  })

  activeController.value = controller
  void controller.start()
}

const sendMessage = async () => {
  await submitMessage(inputMessage.value)
}

const sendPresetPrompt = async (prompt: string) => {
  await submitMessage(prompt)
}

const stopStreaming = async () => {
  if (!activeController.value || !activeRequestId.value) {
    return
  }

  await activeController.value.stop()
}

const resetConversation = () => {
  if (isStreaming.value) {
    return
  }

  inputMessage.value = ''
  messages.value = []
}

const closeDialog = () => {
  if (isStreaming.value) {
    return
  }

  emit('update:modelValue', false)
}

const handleVisibilityChange = (value: boolean) => {
  if (!value && isStreaming.value) {
    return
  }

  emit('update:modelValue', value)
}

const handleOpen = async () => {
  await ensureReady()
}

const handleClosed = async () => {
  await activeController.value?.dispose()
  activeController.value = null
  activeRequestId.value = ''
  isStreaming.value = false
}

const handleInputEnter = (event: KeyboardEvent) => {
  if (event.shiftKey) {
    return
  }

  event.preventDefault()
  void sendMessage()
}

watch(
  () => props.bookKey,
  async (nextBookKey, previousBookKey) => {
    if (nextBookKey === previousBookKey) {
      return
    }

    await activeController.value?.dispose()
    activeController.value = null
    activeRequestId.value = ''
    isStreaming.value = false
    resetConversation()
    bookContext.value = ''
    loadedBookKey.value = null
    contextError.value = ''
    if (props.modelValue) {
      await loadBookContext()
    }
  },
)

onBeforeUnmount(() => {
  void activeController.value?.dispose()
})
</script>

<style lang="scss" scoped>
.assistant-workspace {
  display: grid;
  grid-template-columns: 274px minmax(0, 1fr);
  height: min(78vh, 760px);
  min-height: 560px;
  overflow: hidden;
  color: var(--text-primary);
  background:
    radial-gradient(circle at 8% 10%, var(--surface-brand-soft), transparent 32%),
    radial-gradient(circle at 92% 92%, var(--surface-warning-soft), transparent 28%),
    var(--surface-strong);
}

.assistant-rail {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
  padding: 20px;
  border-right: 1px solid var(--border-default);
  background: color-mix(in srgb, var(--surface-card-soft) 86%, transparent);
}

.assistant-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.assistant-avatar {
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-brand);
  background: var(--surface-card);
  box-shadow: var(--shadow-sm);
}

.assistant-brand-copy {
  min-width: 0;
}

.assistant-title {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 800;
  line-height: 1.2;
}

.assistant-subtitle {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.rail-section {
  padding: 14px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--surface-card) 88%, transparent);
  box-shadow: var(--shadow-xs);
}

.rail-section--context {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rail-label {
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 800;
}

.context-meter {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
}

.context-dot {
  width: 9px;
  height: 9px;
  border-radius: var(--radius-pill);
  background: var(--text-muted);

  &.is-active {
    background: var(--brand-primary);
    box-shadow: 0 0 0 5px var(--ring-brand-soft);
  }
}

.context-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;

  > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding: 10px;
    border-radius: var(--radius-md);
    background: var(--surface-card-soft);
  }
}

.stat-value {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 800;
}

.stat-label {
  color: var(--text-tertiary);
  font-size: 11px;
}

.prompt-chip {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: var(--t-mouse-cursor-link), pointer;
  transition:
    background-color var(--duration-fast) var(--easing-standard),
    border-color var(--duration-fast) var(--easing-standard),
    color var(--duration-fast) var(--easing-standard);

  svg {
    width: 15px;
    height: 15px;
    flex: 0 0 auto;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
  }

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    border-color: var(--border-brand);
    background: var(--surface-brand-soft);
    color: var(--brand-primary);
    outline: none;
  }

  &:disabled {
    opacity: 0.45;
    cursor: var(--t-mouse-cursor-unavailable), not-allowed;
  }
}

.rail-actions {
  display: flex;
  gap: 10px;
  margin-top: auto;
}

.rail-icon-button,
.composer-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  color: var(--text-primary);
  cursor: var(--t-mouse-cursor-link), pointer;
  transition:
    background-color var(--duration-fast) var(--easing-standard),
    border-color var(--duration-fast) var(--easing-standard),
    color var(--duration-fast) var(--easing-standard),
    transform var(--duration-fast) var(--easing-standard);

  svg {
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
  }

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    border-color: var(--border-brand);
    background: var(--surface-brand-soft);
    color: var(--brand-primary);
    outline: none;
  }

  &:active:not(:disabled) {
    transform: scale(0.96);
  }

  &:disabled {
    opacity: 0.45;
    cursor: var(--t-mouse-cursor-unavailable), not-allowed;
  }
}

.rail-icon-button {
  width: 44px;
  height: 44px;

  svg {
    width: 18px;
    height: 18px;
  }
}

.assistant-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--surface-strong) 92%, transparent);
}

.conversation-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 86px;
  padding: 20px 26px 16px;
  border-bottom: 1px solid var(--border-soft);
}

.topbar-kicker {
  color: var(--brand-primary);
  font-size: 11px;
  font-weight: 800;
}

.conversation-topbar h2 {
  margin: 4px 0 0;
  color: var(--text-primary);
  font-size: 24px;
  font-weight: 850;
  line-height: 1.2;
}

.topbar-status {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-pill);
  background: var(--surface-card-soft);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;

  &.is-streaming .status-pulse {
    animation: status-pulse 1.1s infinite ease-in-out;
  }
}

.status-pulse {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-pill);
  background: var(--brand-primary);
}

.assistant-state,
.conversation-panel {
  min-height: 0;
  flex: 1;
}

.assistant-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  margin: 24px;
  padding: 28px;
  border: 1px solid var(--border-danger);
  border-radius: var(--radius-lg);
  background: var(--surface-danger-gradient);
  text-align: center;
}

.state-title {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 800;
}

.state-text {
  max-width: 560px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.conversation-panel {
  display: flex;
  flex-direction: column;
}

.assistant-scrollbar {
  flex: 1;
  min-height: 0;
  padding: 20px 24px 0;
}

.assistant-empty {
  height: 100%;
  min-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  text-align: center;
}

.empty-orbit {
  position: relative;
  width: 74px;
  height: 74px;
  margin-bottom: 4px;
  border-radius: var(--radius-pill);
  background:
    radial-gradient(circle at 50% 50%, var(--surface-brand-soft-strong), transparent 48%),
    var(--surface-card);
  border: 1px solid var(--border-brand);
  box-shadow: var(--shadow-sm);

  span {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: var(--radius-pill);
    background: var(--brand-primary);

    &:nth-child(1) {
      top: 18px;
      left: 18px;
    }

    &:nth-child(2) {
      top: 30px;
      right: 15px;
      opacity: 0.72;
    }

    &:nth-child(3) {
      left: 30px;
      bottom: 15px;
      opacity: 0.46;
    }
  }
}

.empty-title {
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 850;
}

.empty-text {
  max-width: 420px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 22px;
  max-width: 780px;
  margin: 0 auto;
  padding: 8px 0 24px;
}

.message-row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.message-row--user {
  grid-template-columns: minmax(0, 1fr);
  justify-items: end;
}

.assistant-mark {
  width: 36px;
  height: 36px;
  overflow: hidden;
  border: 1px solid var(--border-brand);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  box-shadow: var(--shadow-xs);

  img {
    width: 100%;
    height: 100%;
  }
}

.message-card {
  max-width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--surface-card) 92%, transparent);
  box-shadow: var(--shadow-xs);
}

.message-row--user .message-card {
  max-width: min(620px, 82%);
  border-color: var(--border-brand);
  border-top-right-radius: var(--radius-xs);
  background: var(--surface-brand-soft);
}

.message-row--assistant .message-card {
  border-top-left-radius: var(--radius-xs);
}

.message-card--streaming {
  border-color: var(--border-brand);
}

.message-card--error {
  border-color: var(--border-danger);
  background: var(--surface-danger-gradient);
}

.message-author {
  margin-bottom: 8px;
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 800;
}

.message-content {
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.72;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.message-meta--error {
  color: var(--text-danger);
}

.typing-bars {
  display: inline-flex;
  align-items: center;
  gap: 3px;

  i {
    width: 3px;
    height: 10px;
    border-radius: var(--radius-pill);
    background: var(--brand-primary);
    animation: typing-bar 0.9s infinite ease-in-out;

    &:nth-child(2) {
      animation-delay: 0.12s;
    }

    &:nth-child(3) {
      animation-delay: 0.24s;
    }
  }
}

.assistant-composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 48px;
  align-items: end;
  gap: 12px;
  margin: 0 24px 22px;
  padding: 14px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--surface-strong) 96%, transparent);
  box-shadow: var(--shadow-lg), var(--shadow-inset-light);
}

.composer-field {
  min-width: 0;

  :deep(.el-textarea__inner) {
    min-height: 56px !important;
    padding: 12px;
    border: 0;
    background: transparent;
    box-shadow: none;
    color: var(--text-primary);
    font-size: 15px;
    line-height: 1.6;
  }
}

.composer-action {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  border-color: var(--border-brand);
  background: var(--surface-brand-strong);
  color: var(--text-on-brand);

  svg {
    width: 20px;
    height: 20px;
  }

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    background: var(--brand-primary-hover);
    color: var(--text-on-brand);
  }

  &:disabled {
    border-color: var(--border-default);
    background: var(--surface-card-soft);
    color: var(--text-muted);
  }
}

.composer-action--danger {
  border-color: var(--border-danger);
  background: var(--danger);
}

.markdown-body {
  :deep(p) {
    margin: 0 0 10px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(pre) {
    margin: 12px 0;
    padding: 12px;
    overflow-x: auto;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    background: var(--surface-code);
  }

  :deep(code) {
    border-radius: var(--radius-xs);
    background: var(--surface-code-inline);
    font-family: var(--font-family-mono);
  }

  :deep(pre code) {
    background: transparent;
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 20px;
  }
}

@keyframes typing-bar {
  0%,
  100% {
    opacity: 0.35;
    transform: scaleY(0.55);
  }

  50% {
    opacity: 1;
    transform: scaleY(1);
  }
}

@keyframes status-pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.82);
  }

  50% {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .typing-bars i,
  .topbar-status.is-streaming .status-pulse {
    animation: none;
  }
}

@media (max-width: 840px) {
  .assistant-workspace {
    grid-template-columns: 1fr;
    height: min(86vh, 780px);
  }

  .assistant-rail {
    border-right: 0;
    border-bottom: 1px solid var(--border-default);
  }

  .rail-section--context,
  .rail-section {
    display: none;
  }

  .conversation-topbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .message-row--user .message-card {
    max-width: 92%;
  }
}
</style>

<style lang="scss">
.assistant-dialog-wrapper {
  display: flex;
  flex-direction: column;
  max-height: min(90vh, 900px);
  overflow: hidden;
  border-radius: var(--radius-xl);

  .el-dialog__header {
    display: none;
  }

  .el-dialog__body {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0;
    overflow: hidden;
  }

  .el-scrollbar__wrap {
    overflow-x: hidden;
  }
}
</style>
