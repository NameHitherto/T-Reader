use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeSeriesDto {
    pub id: String,
    pub name: String,
    pub description: String,
    pub document_count: i64,
    pub ready_document_count: i64,
    pub chunk_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateKnowledgeSeriesRequest {
    pub name: String,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateKnowledgeSeriesRequest {
    pub series_id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeDocumentDto {
    pub id: String,
    pub series_id: String,
    pub original_file_name: String,
    pub stored_file_name: String,
    pub file_hash: String,
    pub title: String,
    pub author: String,
    pub char_count: i64,
    pub chunk_count: i64,
    pub status: String,
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeCitation {
    pub document_id: String,
    pub book_title: String,
    pub chapter_title: String,
    pub chapter_index: i64,
    pub paragraph_index: i64,
    pub content: String,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeQaMessageDto {
    pub id: String,
    pub series_id: String,
    pub role: String,
    pub content: String,
    pub citations: Vec<KnowledgeCitation>,
    pub provider_type: String,
    pub model_id: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendKnowledgeQaMessageRequest {
    pub series_id: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeAnswerStreamChunk {
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeQaContextInfo {
    pub series_id: String,
    pub has_documents: bool,
    pub chunk_count: i64,
    pub chat_configured: bool,
    pub embedding_configured: bool,
    pub rerank_configured: bool,
    pub available: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeIngestProgressEvent {
    pub document_id: String,
    pub stage: String,
    pub processed_chunks: i64,
    pub total_chunks: i64,
    pub message: String,
}

#[derive(Debug, Clone, FromRow)]
pub struct KnowledgeChunkRecord {
    pub id: String,
    pub series_id: String,
    pub document_id: String,
    pub chapter_index: i64,
    pub chapter_title: String,
    pub paragraph_index: i64,
    pub content: String,
    pub vector: Vec<u8>,
    pub embedding_model: String,
}
