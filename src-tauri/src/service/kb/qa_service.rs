use serde_json::{Value, json};
use sqlx::SqlitePool;
use tauri::ipc::Channel;

use crate::{
    entities::{
        KnowledgeAnswerStreamChunk, KnowledgeCitation, KnowledgeQaContextInfo,
        KnowledgeQaMessageDto, SendKnowledgeQaMessageRequest,
    },
    repository::knowledge_base as knowledge_repository,
    service::kb::{
        model_client,
        vector_store::{normalize_vector, rank_chunks_by_query},
    },
    utils::{
        logging::{log_error, log_info},
        token_budget::fit_messages_to_context,
    },
};

const MAX_HISTORY_MESSAGES: usize = 20;
const RETRIEVAL_CANDIDATES: usize = 40;
const RERANK_TOP_N: usize = 6;
const MAX_OUTPUT_TOKENS: usize = 4096;

pub async fn get_knowledge_qa_context(
    pool: &SqlitePool,
    series_id: &str,
) -> Result<KnowledgeQaContextInfo, String> {
    let series = knowledge_repository::get_series(pool, series_id)
        .await?
        .ok_or_else(|| format!("知识库系列不存在: {}", series_id))?;

    let has_documents = series.document_count > 0;
    let chunk_count = knowledge_repository::count_chunks(pool, series_id).await?;
    let chat_configured = model_client::get_chat_provider(pool).await.is_ok();
    let embedding_configured = model_client::get_embedding_provider(pool).await.is_ok();
    let rerank_configured = model_client::get_rerank_provider(pool).await.is_ok();

    let mut reason = None;
    if !has_documents {
        reason = Some("请先向该系列导入书籍".to_string());
    } else if chunk_count == 0 {
        reason = Some("该系列尚未完成向量索引".to_string());
    } else if !chat_configured {
        reason = Some("请先在设置中配置对话模型".to_string());
    } else if !embedding_configured {
        reason = Some("请先在设置中配置嵌入模型".to_string());
    } else if !rerank_configured {
        reason = Some("请先在设置中配置重排序模型".to_string());
    }

    Ok(KnowledgeQaContextInfo {
        series_id: series_id.to_string(),
        has_documents,
        chunk_count,
        chat_configured,
        embedding_configured,
        rerank_configured,
        available: reason.is_none(),
        reason,
    })
}

pub async fn list_qa_messages(
    pool: &SqlitePool,
    series_id: &str,
) -> Result<Vec<KnowledgeQaMessageDto>, String> {
    ensure_series_exists(pool, series_id).await?;
    knowledge_repository::list_qa_messages(pool, series_id).await
}

pub async fn clear_qa_messages(pool: &SqlitePool, series_id: &str) -> Result<(), String> {
    ensure_series_exists(pool, series_id).await?;
    knowledge_repository::clear_qa_messages(pool, series_id).await
}

pub async fn send_qa_message(
    pool: &SqlitePool,
    request: SendKnowledgeQaMessageRequest,
    on_event: Channel<KnowledgeAnswerStreamChunk>,
) -> Result<KnowledgeQaMessageDto, String> {
    let content = request.content.trim().to_string();
    if content.is_empty() {
        return Err("问题不能为空".to_string());
    }

    let series = knowledge_repository::get_series(pool, &request.series_id)
        .await?
        .ok_or_else(|| format!("知识库系列不存在: {}", request.series_id))?;

    let context = get_knowledge_qa_context(pool, &request.series_id).await?;
    if !context.available {
        return Err(context
            .reason
            .unwrap_or_else(|| "当前系列暂不可问答".to_string()));
    }

    let chat_provider = model_client::get_chat_provider(pool).await?;
    let history = knowledge_repository::list_qa_messages(pool, &request.series_id).await?;
    knowledge_repository::insert_qa_message(
        pool,
        &request.series_id,
        "user",
        &content,
        &[],
        "",
        "",
    )
    .await?;

    let citations = retrieve_citations(pool, &request.series_id, &content).await?;
    let system_prompt = build_system_prompt(&series.name, &citations);

    let mut messages = provider_messages(&history);
    messages.push(json!({
        "role": "user",
        "content": content,
    }));
    let messages = fit_messages_to_context(
        &system_prompt,
        messages,
        chat_provider.context_window_size,
        MAX_OUTPUT_TOKENS,
    )?;

    let answer =
        match model_client::stream_chat_completion(pool, &system_prompt, messages, &on_event).await
        {
            Ok(answer) => answer,
            Err(error) => {
                log_error(
                    "knowledge-base",
                    &format!("chat failed series={} error={}", request.series_id, error),
                );
                return Err(error);
            }
        };

    let assistant = knowledge_repository::insert_qa_message(
        pool,
        &request.series_id,
        "assistant",
        &answer,
        &citations,
        &chat_provider.provider_type,
        &chat_provider.model_id,
    )
    .await?;

    log_info(
        "knowledge-base",
        &format!(
            "qa-message-saved id={} citations={}",
            assistant.id,
            citations.len()
        ),
    );
    Ok(assistant)
}

async fn ensure_series_exists(pool: &SqlitePool, series_id: &str) -> Result<(), String> {
    if knowledge_repository::get_series(pool, series_id)
        .await?
        .is_none()
    {
        return Err(format!("知识库系列不存在: {}", series_id));
    }
    Ok(())
}

async fn retrieve_citations(
    pool: &SqlitePool,
    series_id: &str,
    query: &str,
) -> Result<Vec<KnowledgeCitation>, String> {
    let chunks = knowledge_repository::list_chunks_for_series(pool, series_id).await?;
    if chunks.is_empty() {
        return Err("该系列没有可检索的文本块".to_string());
    }

    let mut query_vector = model_client::embed_query(pool, query).await?;
    normalize_vector(&mut query_vector);

    let ranked = rank_chunks_by_query(&query_vector, &chunks, RETRIEVAL_CANDIDATES)?;
    let candidate_documents: Vec<String> = ranked
        .iter()
        .map(|(index, _)| chunks[*index].content.clone())
        .collect();

    let reranked =
        model_client::rerank_documents(pool, query, &candidate_documents, RERANK_TOP_N).await?;
    let mut citations = Vec::new();
    for (candidate_index, score) in reranked {
        let chunk_index = ranked[candidate_index].0;
        let chunk = &chunks[chunk_index];
        citations.push(KnowledgeCitation {
            document_id: chunk.document_id.clone(),
            book_title: String::new(),
            chapter_title: chunk.chapter_title.clone(),
            chapter_index: chunk.chapter_index,
            paragraph_index: chunk.paragraph_index,
            content: chunk.content.clone(),
            score: score as f64,
        });
    }

    enrich_citation_titles(pool, &mut citations).await?;
    Ok(citations)
}

async fn enrich_citation_titles(
    pool: &SqlitePool,
    citations: &mut [KnowledgeCitation],
) -> Result<(), String> {
    for citation in citations.iter_mut() {
        if let Some(document) =
            knowledge_repository::get_document(pool, &citation.document_id).await?
        {
            citation.book_title = document.title;
        }
    }
    Ok(())
}

fn build_system_prompt(series_name: &str, citations: &[KnowledgeCitation]) -> String {
    let mut context = String::new();
    for (index, citation) in citations.iter().enumerate() {
        context.push_str(&format!(
            "\n[{}] 《{}》- {}（第 {} 段）：{}",
            index + 1,
            citation.book_title,
            citation.chapter_title,
            citation.paragraph_index + 1,
            citation.content
        ));
    }

    format!(
        "你是“{}”知识库的问答助手。请严格依据下面的原文片段回答用户问题；如果片段中没有答案，请明确说明“知识库中未提及”，不要编造。引用原文时请使用 [编号] 标注。\n\n【原文片段】{}\n",
        series_name, context
    )
}

fn provider_messages(history: &[KnowledgeQaMessageDto]) -> Vec<Value> {
    history
        .iter()
        .rev()
        .take(MAX_HISTORY_MESSAGES)
        .rev()
        .map(|message| {
            json!({
                "role": message.role,
                "content": message.content,
            })
        })
        .collect()
}
