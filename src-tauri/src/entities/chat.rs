use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct BookChatMessageDto {
    pub id: String,
    pub role: String,
    pub content: String,
    pub provider_type: String,
    pub model_id: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendBookChatMessageRequest {
    pub book_key: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookChatStreamChunk {
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookChatContextInfo {
    pub book_key: String,
    pub book_title: String,
    pub author: String,
    pub text_char_count: usize,
    pub max_text_chars: usize,
    pub model_configured: bool,
    pub available: bool,
    pub reason: Option<String>,
}
