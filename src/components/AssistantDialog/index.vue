<template>
  <el-dialog
    align-center
    class="assistant-dialog-wrapper"
    :append-to-body="true"
    :show-close="false"
    :close-on-press-escape="false"
    @open="onOpen"
  >
    <div class="assistant-dialog-view">
      <div class="assistant-chat-container">
        <el-scrollbar ref="scrollbar" max-height="50vh">
          <div v-if="chatHistory.length === 0 && !responseMessage" class="chat-welcome">
            <div class="chat-welcome-title">
              <div class="chat-welcome-favicon">
                <img :src="faviconImg" />
              </div>
              我是对话助手，很高兴见到你
            </div>
            <div class="chat-welcome-desc">
              如果你对本书有任何疑问，我或许可以帮你解答。
            </div>
          </div>
          <div v-else class="chat-history">
            <template v-for="(chat, idx) in chatHistory" :key="idx">
              <div v-if="chat.role === 'user'" class="chat-user">
                <div class="chat-content">{{ chat.content }}</div>
              </div>
              <div v-else-if="chat.role === 'assistant'" class="chat-assistant">
                <div class="chat-favicon">
                  <img :src="faviconImg" />
                </div>
                <div class="chat-content" v-html="convertToMd(chat.content)"></div>
              </div>
            </template>
            <div v-if="responseMessage" class="chat-go-on chat-assistant">
              <div class="chat-favicon">
                <img :src="faviconImg" />
              </div>
              <div class="chat-content" v-html="convertToMd(responseMessage)"></div>
            </div>
          </div>
        </el-scrollbar>
      </div>
      <div class="assistant-input-container">
        <div class="input">
          <div class="input-textarea">
            <el-input
              v-model="inputMessage"
              type="textarea"
              resize="none"
              placeholder="有关此书的问题，可以在这里提问"
              :autosize="{ minRows: 2, maxRows: 6 }"
              @keydown.enter="handleInputEnter"
            />
          </div>
          <div class="input-operation">
            <div class="operation-end">
              <div class="operation-new-chat">
                <el-button circle @click="reset">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="m20.713 8.128l-.246.566a.506.506 0 0 1-.934 0l-.246-.566a4.36 4.36 0 0 0-2.22-2.25l-.759-.339a.53.53 0 0 1 0-.963l.717-.319a4.37 4.37 0 0 0 2.251-2.326l.253-.611a.506.506 0 0 1 .942 0l.253.61a4.37 4.37 0 0 0 2.25 2.327l.718.32a.53.53 0 0 1 0 .962l-.76.338a4.36 4.36 0 0 0-2.219 2.251M10 3h4v2h-4a6 6 0 0 0-6 6c0 3.61 2.462 5.966 8 8.48V17h2a6 6 0 0 0 6-6h2a8 8 0 0 1-8 8v3.5c-5-2-12-5-12-11.5a8 8 0 0 1 8-8"/></svg>
                </el-button>
              </div>
              <div class="operation-send">
                <el-button
                  v-if="!isWaiting"
                  :disabled="!inputMessage"
                  type="primary"
                  circle
                  @click="sendMessage"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m5 12l-.604-5.437C4.223 5.007 5.825 3.864 7.24 4.535l11.944 5.658c1.525.722 1.525 2.892 0 3.614L7.24 19.466c-1.415.67-3.017-.472-2.844-2.028zm0 0h7"/></svg>
                </el-button>
                <el-button v-else type="danger" circle @click="stopStream">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M7 15.385v-6.77q0-.666.475-1.14T8.615 7h6.77q.666 0 1.14.475T17 8.615v6.77q0 .666-.475 1.14t-1.14.475h-6.77q-.666 0-1.14-.475T7 15.386"/></svg>
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>
<script lang="ts">
import { defineComponent, ref, nextTick } from 'vue'
import favicon from '@/assets/images/roxy.png'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import MarkdownIt from 'markdown-it/index'
import hljs from 'highlight.js'
import { extractBookContent } from '@/services/book/bookContentService'
import { logError } from '@/utils/logger'

interface StreamPayload {
  chunk: string
}

export default defineComponent({
  name: 'AssistantDialog',
  props: {
    bookKey: {
      type: [String, null],
      required: true,
    },
  },
  data() {
    return {
      inputMessage: ref(''),
      isWaiting: false,
      isCanceled: false,
      responseMessage: ref(''),
      chatHistory: [] as Array<{ role: string; content: string }>,
      faviconImg: favicon,
      referedBookInfo: ref(''),
    }
  },
  watch: {
    chatHistory() {
      this.scrollToBottom()
    },
    responseMessage() {
      this.scrollToBottom()
    },
  },
  methods: {
    async onOpen() {
      if (this.bookKey === null) {
        logError('assistant', 'bookKey is required')
        return
      }
      this.referedBookInfo = await extractBookContent(this.bookKey)
    },
    async sendMessage() {
      if (!this.inputMessage) return
      this.isWaiting = true

      const systemMessage = {
        role: 'system',
        content:
          '你是一名对话助手，接下来用户可能会提问有关一本书内容的问题，你需要基于原文进行回答，这本书的原文如下：\n\n' +
          this.referedBookInfo,
      }

      this.chatHistory.push({
        role: 'user',
        content: this.inputMessage,
      })

      this.inputMessage = ''

      try {
        const unlisten = await listen('stream-chunk', (event) => {
          const chunk = (event.payload as StreamPayload).chunk

          if (this.isCanceled) {
            this.isCanceled = false
            this.chatHistory.push({
              role: 'assistant',
              content: '对话已取消',
            })
            this.responseMessage = ''
            unlisten()
            return
          }

          if (chunk === '[DONE]') {
            this.isWaiting = false

            this.chatHistory.push({
              role: 'assistant',
              content: this.responseMessage,
            })
            this.responseMessage = ''
            unlisten()
          } else {
            const jsonStr = JSON.parse(chunk)
            this.responseMessage += jsonStr.choices[0].delta.content
          }
        })

        await invoke('start_stream', {
          messages: JSON.stringify([systemMessage, ...this.chatHistory]),
        })
      } catch (e) {
        this.chatHistory.pop()
        logError('assistant', '聊天流异常', e)
      }
    },
    stopStream() {
      this.isWaiting = false
      this.isCanceled = true
    },
    reset() {
      this.inputMessage = ''
      this.chatHistory = []
    },
    handleInputEnter(event: KeyboardEvent) {
      if (event.shiftKey) {
        return
      }

      event.preventDefault()
      this.sendMessage()
    },
    scrollToBottom() {
      nextTick(() => {
        const scrollbar = this.$refs.scrollbar as { setScrollTop: (top: number) => void } | undefined
        scrollbar?.setScrollTop(999999)
      })
    },
    convertToMd(originMsg: string) {
      const md: MarkdownIt = new MarkdownIt({
        html: true,
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
            } catch (e) {
              logError('assistant', '代码高亮失败', e)
            }
          }
          return `<pre><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`
        },
      })

      return md.render(originMsg)
    },
  },
})
</script>
<style lang="scss" scoped>
.assistant-dialog-wrapper {
  max-width: 600px;

  .assistant-dialog-view {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .assistant-chat-container {
      .chat-welcome {
        width: 100%;
        display: inline-flex;
        flex-direction: column;
        align-items: center;

        .chat-welcome-title {
          font-size: 22px;
          color: var(--text-primary);
          font-weight: 500;
          display: inline-flex;
          gap: 14px;
          align-items: center;

          .chat-welcome-favicon {
            width: 45px;
            height: 45px;

            img {
              width: 100%;
              height: 100%;
              border-radius: 50%;
            }
          }
        }
        .chat-welcome-desc {
          color: var(--text-tertiary);
          margin: 8px 0 20px 0;
          font-size: 14px;
          text-align: center;
        }
      }
      .chat-history {
        .chat-user {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 16px;

          .chat-content {
            font-size: 16px;
            line-height: 20px;
            color: var(--text-primary);
            max-width: calc(100% - 80px);
            padding: 10px 20px;
            white-space: pre-wrap;
            word-break: break-word;
            background: var(--surface-brand-soft);
            border: 1px solid var(--border-brand);
            border-radius: 14px;
            position: relative;
            box-shadow: var(--shadow-sm);
          }
        }
        .chat-assistant {
          display: flex;
          justify-content: flex-start;
          margin-bottom: 16px;

          .chat-favicon {
            width: 40px;
            height: 40px;
            box-shadow: 0 0 0 1px var(--border-brand);
            border-radius: 50%;

            img {
              width: 100%;
              height: 100%;
              border-radius: 50%;
            }
          }
          .chat-content {
            font-size: 16px;
            line-height: 20px;
            color: var(--text-secondary);
            padding: 0 10px;
            max-width: calc(100% - 60px);
          }
        }
      }
    }
    .assistant-input-container {
      .input {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: flex-start;
        padding: 10px;
        background: var(--surface-card-soft);
        box-shadow:
          0 0 0 1px var(--border-default) inset,
          var(--shadow-sm);
        border-radius: 24px;

        .input-textarea {
          width: 100%;

          :deep(.el-textarea) {
            textarea {
              background-color: transparent;
              color: var(--text-primary);
              margin: 0;
              padding: 0;
              outline: none;
              line-height: 20px;
              font-size: 16px;
              box-shadow: none;
            }
          }
        }
        .input-operation {
          width: 100%;
          display: inline-flex;
          justify-content: flex-end;

          .operation-end {
            display: inline-flex;
            gap: 10px;

            :deep(.el-button) {
              cursor: var(--t-mouse-cursor-link), pointer;
            }

            :deep(.el-button.is-disabled) {
              cursor: var(--t-mouse-cursor-unavailable), not-allowed;
            }
          }
        }
      }
    }
  }
}
</style>
