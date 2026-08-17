use tauri::{ipc::Channel, State};

use crate::{
    database::DatabaseState,
    entities::{
        BookChatContextInfo, BookChatMessageDto, BookChatStreamChunk,
        SendBookChatMessageRequest,
    },
    repository::chat as chat_repository,
    service::chat::book_chat_service,
};

#[tauri::command]
pub async fn get_book_chat_context(
    database: State<'_, DatabaseState>,
    book_key: String,
) -> Result<BookChatContextInfo, String> {
    book_chat_service::get_book_chat_context(&database.pool, &book_key).await
}

#[tauri::command]
pub async fn list_book_chat_messages(
    database: State<'_, DatabaseState>,
    book_key: String,
) -> Result<Vec<BookChatMessageDto>, String> {
    chat_repository::list_book_chat_messages(&database.pool, &book_key).await
}

#[tauri::command]
pub async fn send_book_chat_message(
    database: State<'_, DatabaseState>,
    request: SendBookChatMessageRequest,
    on_event: Channel<BookChatStreamChunk>,
) -> Result<BookChatMessageDto, String> {
    book_chat_service::send_book_chat_message(&database.pool, request, on_event).await
}

#[tauri::command]
pub async fn clear_book_chat_messages(
    database: State<'_, DatabaseState>,
    book_key: String,
) -> Result<(), String> {
    chat_repository::clear_book_chat_messages(&database.pool, &book_key).await
}
