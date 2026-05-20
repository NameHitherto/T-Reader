export type AssistantChatRole = 'user' | 'assistant'

export interface AssistantChatMessage {
  role: AssistantChatRole
  content: string
}

export type AssistantStreamEventName = 'delta' | 'done' | 'error' | 'cancelled'

export interface AssistantStreamEvent {
  requestId: string
  event: AssistantStreamEventName
  payload?: {
    text?: string
    message?: string
  }
}

export interface StartAssistantStreamOptions {
  requestId: string
  systemPrompt: string
  messages: AssistantChatMessage[]
  onDelta: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
  onCancelled: () => void
}
