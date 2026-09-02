<template>
  <el-dialog
    :model-value="modelValue"
    align-center
    title="智能问答"
    class="book-chat-dialog"
    width="560px"
    :append-to-body="true"
    :show-close="false"
    :close-on-press-escape="false"
    :destroy-on-close="false"
    @open="onOpen"
    @close="onClose"
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
  >
    <div v-if="context && !context.available" class="chat-unavailable">
      {{ context.reason }}
    </div>

    <div ref="messageListEl" class="chat-messages">
      <div v-if="isLoading" class="chat-state">正在加载会话…</div>
      <template v-else>
        <div
          v-for="message in messages"
          :key="message.id"
          class="chat-message"
          :class="`chat-message--${message.role}`"
        >
          <div class="chat-bubble">
            <MarkdownContent v-if="message.role === 'assistant'" :content="message.content" />
            <template v-else>{{ message.content }}</template>
          </div>
        </div>

        <div v-if="isStreaming" class="chat-message chat-message--assistant">
          <div class="chat-bubble">
            <MarkdownContent :content="streamingText || '正在思考…'" />
          </div>
        </div>

        <div v-if="messages.length === 0 && !isStreaming" class="chat-state">
          向我提问，我会基于本书正文回答。
        </div>
      </template>
    </div>

    <div class="chat-input-row">
      <el-input
        v-model="draft"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 5 }"
        resize="none"
        maxlength="4000"
        show-word-limit
        placeholder="请输入问题"
        :disabled="inputDisabled"
        @keydown.ctrl.enter.prevent="send"
      />
      <el-button type="primary" :loading="isStreaming" :disabled="!canSend" @click="send">
        发送
      </el-button>
    </div>

    <template #footer>
      <el-button :disabled="isStreaming || messages.length === 0" @click="clearConversation">
        清空会话
      </el-button>
      <el-button @click="close">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { BookChatContextInfo, BookChatMessage } from '@/services/chat/types'
import {
  clearBookChatMessages,
  getBookChatContext,
  listBookChatMessages,
  sendBookChatMessage,
} from '@/services/chat'
import { logError } from '@/utils/logger'
import { generateID } from '@/utils/id'
import MarkdownContent from '@/components/common/MarkdownContent/index.vue'

const props = defineProps<{
  modelValue: boolean
  bookKey: string | null
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>()

const messages = ref<BookChatMessage[]>([])
const context = ref<BookChatContextInfo | null>(null)
const draft = ref('')
const isStreaming = ref(false)
const streamingText = ref('')
const isLoading = ref(false)
const messageListEl = ref<HTMLElement | null>(null)

const inputDisabled = computed(() => {
  return !context.value || context.value.available !== true || isStreaming.value
})

const canSend = computed(() => {
  return (
    Boolean(props.bookKey) &&
    context.value?.available === true &&
    !isStreaming.value &&
    draft.value.trim().length > 0
  )
})

const scrollToBottom = async () => {
  await nextTick()
  if (messageListEl.value) {
    messageListEl.value.scrollTop = messageListEl.value.scrollHeight
  }
}

const loadConversation = async () => {
  if (!props.bookKey) {
    return
  }

  isLoading.value = true
  const bookKey = props.bookKey

  try {
    const [nextContext, nextMessages] = await Promise.all([
      getBookChatContext(bookKey),
      listBookChatMessages(bookKey),
    ])

    if (bookKey !== props.bookKey) {
      return
    }

    context.value = nextContext
    messages.value = nextMessages
    await scrollToBottom()
  } catch (error) {
    if (bookKey === props.bookKey) {
      context.value = null
      messages.value = []
      ElMessage.error(String(error))
    }
  } finally {
    if (bookKey === props.bookKey) {
      isLoading.value = false
    }
  }
}

const send = async () => {
  if (!props.bookKey || !canSend.value) {
    return
  }

  const bookKey = props.bookKey
  const content = draft.value.trim()
  draft.value = ''
  messages.value.push({
    id: `local-${generateID(6)}`,
    role: 'user',
    content,
    providerType: '',
    modelId: '',
    createdAt: new Date().toISOString(),
  })
  isStreaming.value = true
  streamingText.value = ''
  await scrollToBottom()

  try {
    await sendBookChatMessage(bookKey, content, (text) => {
      if (bookKey === props.bookKey) {
        streamingText.value += text
        void scrollToBottom()
      }
    })

    if (bookKey === props.bookKey) {
      messages.value = await listBookChatMessages(bookKey)
      await scrollToBottom()
    }
  } catch (error) {
    logError('book-chat', 'send-message failed', error)
    if (bookKey === props.bookKey) {
      ElMessage.error(String(error))
      try {
        messages.value = await listBookChatMessages(bookKey)
      } catch {
        // 保留当前界面状态，等待用户重试或重新打开。
      }
    }
  } finally {
    if (bookKey === props.bookKey) {
      isStreaming.value = false
      streamingText.value = ''
    }
  }
}

const clearConversation = async () => {
  if (!props.bookKey || isStreaming.value) {
    return
  }

  try {
    await ElMessageBox.confirm('确定清空本书的对话记录吗？', '清空会话', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  try {
    await clearBookChatMessages(props.bookKey)
    messages.value = []
  } catch (error) {
    ElMessage.error(String(error))
  }
}

const onOpen = () => {
  void loadConversation()
}

const onClose = () => {
  draft.value = ''
}

const close = () => {
  emit('update:modelValue', false)
}

watch(
  () => props.bookKey,
  () => {
    messages.value = []
    context.value = null
    draft.value = ''
    isStreaming.value = false
    streamingText.value = ''

    if (props.modelValue) {
      void loadConversation()
    }
  },
)
</script>

<style lang="scss" scoped>
.book-chat-dialog {
  :deep(.el-dialog__body) {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 12px;
  }
}

.chat-unavailable {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-card-soft);
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.chat-messages {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 280px;
  max-height: 420px;
  overflow-y: auto;
  padding-right: 4px;
}

.chat-message {
  display: flex;
}

.chat-message--user {
  justify-content: flex-end;
}

.chat-message--assistant {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: 82%;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-message--user .chat-bubble {
  color: #ffffff;
  background: var(--color-primary, #2563eb);
  border-bottom-right-radius: 4px;
}

.chat-message--assistant .chat-bubble {
  color: var(--text-primary);
  background: var(--surface-strong);
  border: 1px solid var(--border-soft);
  border-bottom-left-radius: 4px;
}

.chat-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  color: var(--text-tertiary);
  font-size: 14px;
}

.chat-input-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-top: 12px;

  :deep(.el-textarea) {
    flex: 1;
  }
}
</style>
