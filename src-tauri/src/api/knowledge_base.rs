use tauri::{State, ipc::Channel};

use crate::{
    database::DatabaseState,
    entities::{
        CreateKnowledgeSeriesRequest, KnowledgeAnswerStreamChunk, KnowledgeDocumentDto,
        KnowledgeIngestProgressEvent, KnowledgeQaContextInfo, KnowledgeQaMessageDto,
        KnowledgeSeriesDto, SendKnowledgeQaMessageRequest, UpdateKnowledgeSeriesRequest,
    },
    repository::knowledge_base as knowledge_repository,
    service::kb::{ingest_service, qa_service},
};

#[tauri::command]
pub async fn list_knowledge_series(
    database: State<'_, DatabaseState>,
) -> Result<Vec<KnowledgeSeriesDto>, String> {
    knowledge_repository::list_series(&database.pool).await
}

#[tauri::command]
pub async fn create_knowledge_series(
    database: State<'_, DatabaseState>,
    request: CreateKnowledgeSeriesRequest,
) -> Result<KnowledgeSeriesDto, String> {
    let name = request.name.trim().to_string();
    if name.is_empty() {
        return Err("系列名称不能为空".to_string());
    }
    knowledge_repository::create_series(&database.pool, &name, request.description.trim()).await
}

#[tauri::command]
pub async fn update_knowledge_series(
    database: State<'_, DatabaseState>,
    request: UpdateKnowledgeSeriesRequest,
) -> Result<KnowledgeSeriesDto, String> {
    let name = request.name.trim().to_string();
    if name.is_empty() {
        return Err("系列名称不能为空".to_string());
    }
    knowledge_repository::update_series(
        &database.pool,
        &request.series_id,
        &name,
        request.description.trim(),
    )
    .await
}

#[tauri::command]
pub async fn delete_knowledge_series(
    database: State<'_, DatabaseState>,
    series_id: String,
) -> Result<(), String> {
    knowledge_repository::delete_series(&database.pool, &series_id).await
}

#[tauri::command]
pub async fn list_knowledge_documents(
    database: State<'_, DatabaseState>,
    series_id: String,
) -> Result<Vec<KnowledgeDocumentDto>, String> {
    knowledge_repository::list_documents(&database.pool, &series_id).await
}

#[tauri::command]
pub async fn import_knowledge_documents(
    database: State<'_, DatabaseState>,
    series_id: String,
    file_paths: Vec<String>,
    on_event: Channel<KnowledgeIngestProgressEvent>,
) -> Result<Vec<KnowledgeDocumentDto>, String> {
    ensure_series_exists(&database.pool, &series_id).await?;
    ingest_service::import_knowledge_documents(&database.pool, &series_id, &file_paths, &on_event)
        .await
}

#[tauri::command]
pub async fn reingest_knowledge_document(
    database: State<'_, DatabaseState>,
    document_id: String,
    on_event: Channel<KnowledgeIngestProgressEvent>,
) -> Result<KnowledgeDocumentDto, String> {
    ingest_service::reingest_document(&database.pool, &document_id, &on_event).await
}

#[tauri::command]
pub async fn delete_knowledge_document(
    database: State<'_, DatabaseState>,
    document_id: String,
) -> Result<(), String> {
    ingest_service::delete_document(&database.pool, &document_id).await
}

#[tauri::command]
pub async fn get_knowledge_qa_context(
    database: State<'_, DatabaseState>,
    series_id: String,
) -> Result<KnowledgeQaContextInfo, String> {
    qa_service::get_knowledge_qa_context(&database.pool, &series_id).await
}

#[tauri::command]
pub async fn list_knowledge_qa_messages(
    database: State<'_, DatabaseState>,
    series_id: String,
) -> Result<Vec<KnowledgeQaMessageDto>, String> {
    qa_service::list_qa_messages(&database.pool, &series_id).await
}

#[tauri::command]
pub async fn clear_knowledge_qa_messages(
    database: State<'_, DatabaseState>,
    series_id: String,
) -> Result<(), String> {
    qa_service::clear_qa_messages(&database.pool, &series_id).await
}

#[tauri::command]
pub async fn send_knowledge_qa_message(
    database: State<'_, DatabaseState>,
    request: SendKnowledgeQaMessageRequest,
    on_event: Channel<KnowledgeAnswerStreamChunk>,
) -> Result<KnowledgeQaMessageDto, String> {
    qa_service::send_qa_message(&database.pool, request, on_event).await
}

async fn ensure_series_exists(pool: &sqlx::SqlitePool, series_id: &str) -> Result<(), String> {
    if knowledge_repository::get_series(pool, series_id)
        .await?
        .is_none()
    {
        return Err(format!("知识库系列不存在: {}", series_id));
    }
    Ok(())
}
