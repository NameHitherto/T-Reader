import { Channel, invoke } from '@tauri-apps/api/core'
import type { BookChatContextInfo, BookChatMessage, BookChatStreamChunk } from '@/types/bookChat'

export const getBookChatContext = async (bookKey: string): Promise<BookChatContextInfo> => {
  return await invoke<BookChatContextInfo>('get_book_chat_context', { bookKey })
}

export const listBookChatMessages = async (bookKey: string): Promise<BookChatMessage[]> => {
  return await invoke<BookChatMessage[]>('list_book_chat_messages', { bookKey })
}

export const clearBookChatMessages = async (bookKey: string): Promise<void> => {
  await invoke('clear_book_chat_messages', { bookKey })
}

export const sendBookChatMessage = async (
  bookKey: string,
  content: string,
  onChunk: (text: string) => void,
): Promise<BookChatMessage> => {
  const onEvent = new Channel<BookChatStreamChunk>((chunk) => {
    onChunk(chunk.text)
  })

  return await invoke<BookChatMessage>('send_book_chat_message', {
    request: {
      bookKey,
      content,
    },
    onEvent,
  })
}
