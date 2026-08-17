use sqlx::{Row, SqlitePool};
use uuid::Uuid;

use crate::entities::{
    KnowledgeChunkRecord, KnowledgeCitation, KnowledgeDocumentDto, KnowledgeQaMessageDto,
    KnowledgeSeriesDto,
};

const DOCUMENT_COLUMNS: &str = r#"
    id, series_id, original_file_name, stored_file_name, file_hash,
    title, author, char_count, chunk_count, status, error_message,
    created_at, updated_at
"#;

pub async fn list_series(pool: &SqlitePool) -> Result<Vec<KnowledgeSeriesDto>, String> {
    sqlx::query_as::<_, KnowledgeSeriesDto>(
        r#"
        SELECT
            s.id,
            s.name,
            s.description,
            COUNT(d.id) AS document_count,
            COALESCE(SUM(CASE WHEN d.status = 'ready' THEN 1 ELSE 0 END), 0) AS ready_document_count,
            COALESCE(SUM(d.chunk_count), 0) AS chunk_count,
            s.created_at,
            s.updated_at
        FROM knowledge_series s
        LEFT JOIN knowledge_documents d ON d.series_id = s.id
        GROUP BY s.id
        ORDER BY s.updated_at DESC, s.name ASC
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn get_series(
    pool: &SqlitePool,
    series_id: &str,
) -> Result<Option<KnowledgeSeriesDto>, String> {
    sqlx::query_as::<_, KnowledgeSeriesDto>(
        r#"
        SELECT
            s.id,
            s.name,
            s.description,
            COUNT(d.id) AS document_count,
            COALESCE(SUM(CASE WHEN d.status = 'ready' THEN 1 ELSE 0 END), 0) AS ready_document_count,
            COALESCE(SUM(d.chunk_count), 0) AS chunk_count,
            s.created_at,
            s.updated_at
        FROM knowledge_series s
        LEFT JOIN knowledge_documents d ON d.series_id = s.id
        WHERE s.id = ?
        GROUP BY s.id
        "#,
    )
    .bind(series_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn create_series(
    pool: &SqlitePool,
    name: &str,
    description: &str,
) -> Result<KnowledgeSeriesDto, String> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO knowledge_series (id, name, description)
        VALUES (?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(name)
    .bind(description)
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    get_series(pool, &id)
        .await?
        .ok_or_else(|| "创建知识库系列失败".to_string())
}

pub async fn update_series(
    pool: &SqlitePool,
    series_id: &str,
    name: &str,
    description: &str,
) -> Result<KnowledgeSeriesDto, String> {
    sqlx::query(
        r#"
        UPDATE knowledge_series
        SET name = ?, description = ?, updated_at = datetime('now')
        WHERE id = ?
        "#,
    )
    .bind(name)
    .bind(description)
    .bind(series_id)
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    get_series(pool, series_id)
        .await?
        .ok_or_else(|| format!("知识库系列不存在: {}", series_id))
}

pub async fn delete_series(pool: &SqlitePool, series_id: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM knowledge_series WHERE id = ?")
        .bind(series_id)
        .execute(pool)
        .await
        .map(|_| ())
        .map_err(|error| error.to_string())
}

pub async fn list_documents(
    pool: &SqlitePool,
    series_id: &str,
) -> Result<Vec<KnowledgeDocumentDto>, String> {
    sqlx::query_as::<_, KnowledgeDocumentDto>(&format!(
        r#"
        SELECT {DOCUMENT_COLUMNS}
        FROM knowledge_documents
        WHERE series_id = ?
        ORDER BY created_at ASC, id ASC
        "#,
    ))
    .bind(series_id)
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn get_document(
    pool: &SqlitePool,
    document_id: &str,
) -> Result<Option<KnowledgeDocumentDto>, String> {
    sqlx::query_as::<_, KnowledgeDocumentDto>(&format!(
        r#"
        SELECT {DOCUMENT_COLUMNS}
        FROM knowledge_documents
        WHERE id = ?
        "#,
    ))
    .bind(document_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn insert_document(
    pool: &SqlitePool,
    series_id: &str,
    original_file_name: &str,
    stored_file_name: &str,
    file_hash: &str,
    title: &str,
    author: &str,
) -> Result<KnowledgeDocumentDto, String> {
    let id = Uuid::new_v4().to_string();
    sqlx::query_as::<_, KnowledgeDocumentDto>(&format!(
        r#"
        INSERT INTO knowledge_documents (
            id, series_id, original_file_name, stored_file_name, file_hash,
            title, author, char_count, chunk_count, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'pending')
        RETURNING {DOCUMENT_COLUMNS}
        "#,
    ))
    .bind(id)
    .bind(series_id)
    .bind(original_file_name)
    .bind(stored_file_name)
    .bind(file_hash)
    .bind(title)
    .bind(author)
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn set_document_ingesting(
    pool: &SqlitePool,
    document_id: &str,
) -> Result<KnowledgeDocumentDto, String> {
    sqlx::query_as::<_, KnowledgeDocumentDto>(&format!(
        r#"
        UPDATE knowledge_documents
        SET status = 'ingesting', error_message = NULL, updated_at = datetime('now')
        WHERE id = ?
        RETURNING {DOCUMENT_COLUMNS}
        "#,
    ))
    .bind(document_id)
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn set_document_ready(
    pool: &SqlitePool,
    document_id: &str,
    char_count: i64,
    chunk_count: i64,
) -> Result<KnowledgeDocumentDto, String> {
    sqlx::query_as::<_, KnowledgeDocumentDto>(&format!(
        r#"
        UPDATE knowledge_documents
        SET status = 'ready', char_count = ?, chunk_count = ?,
            error_message = NULL, updated_at = datetime('now')
        WHERE id = ?
        RETURNING {DOCUMENT_COLUMNS}
        "#,
    ))
    .bind(char_count)
    .bind(chunk_count)
    .bind(document_id)
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn set_document_error(
    pool: &SqlitePool,
    document_id: &str,
    message: &str,
) -> Result<KnowledgeDocumentDto, String> {
    sqlx::query_as::<_, KnowledgeDocumentDto>(&format!(
        r#"
        UPDATE knowledge_documents
        SET status = 'error', error_message = ?, updated_at = datetime('now')
        WHERE id = ?
        RETURNING {DOCUMENT_COLUMNS}
        "#,
    ))
    .bind(message)
    .bind(document_id)
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn delete_document(pool: &SqlitePool, document_id: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM knowledge_documents WHERE id = ?")
        .bind(document_id)
        .execute(pool)
        .await
        .map(|_| ())
        .map_err(|error| error.to_string())
}

pub async fn replace_chunks(
    pool: &SqlitePool,
    chunks: &[KnowledgeChunkRecord],
) -> Result<(), String> {
    if chunks.is_empty() {
        return Ok(());
    }

    let document_id = &chunks[0].document_id;
    sqlx::query("DELETE FROM knowledge_chunks WHERE document_id = ?")
        .bind(document_id)
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;

    for chunk in chunks {
        sqlx::query(
            r#"
            INSERT INTO knowledge_chunks (
                id, series_id, document_id, chapter_index, chapter_title,
                paragraph_index, content, vector, embedding_model
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&chunk.id)
        .bind(&chunk.series_id)
        .bind(&chunk.document_id)
        .bind(chunk.chapter_index)
        .bind(&chunk.chapter_title)
        .bind(chunk.paragraph_index)
        .bind(&chunk.content)
        .bind(&chunk.vector)
        .bind(&chunk.embedding_model)
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;
    }

    Ok(())
}

pub async fn list_chunks_for_series(
    pool: &SqlitePool,
    series_id: &str,
) -> Result<Vec<KnowledgeChunkRecord>, String> {
    sqlx::query_as::<_, KnowledgeChunkRecord>(
        r#"
        SELECT
            id, series_id, document_id, chapter_index, chapter_title,
            paragraph_index, content, vector, embedding_model, created_at
        FROM knowledge_chunks
        WHERE series_id = ?
        "#,
    )
    .bind(series_id)
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn count_chunks(pool: &SqlitePool, series_id: &str) -> Result<i64, String> {
    sqlx::query_scalar("SELECT COUNT(*) FROM knowledge_chunks WHERE series_id = ?")
        .bind(series_id)
        .fetch_one(pool)
        .await
        .map_err(|error| error.to_string())
}

pub async fn list_qa_messages(
    pool: &SqlitePool,
    series_id: &str,
) -> Result<Vec<KnowledgeQaMessageDto>, String> {
    let rows = sqlx::query(
        r#"
        SELECT id, series_id, role, content, citations, provider_type, model_id, created_at
        FROM knowledge_qa_messages
        WHERE series_id = ?
        ORDER BY created_at ASC, id ASC
        "#,
    )
    .bind(series_id)
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())?;

    rows.iter()
        .map(|row| parse_qa_message_row(row))
        .collect::<Result<Vec<_>, _>>()
}

fn parse_qa_message_row(row: &sqlx::sqlite::SqliteRow) -> Result<KnowledgeQaMessageDto, String> {
    let citations_text: String = row
        .try_get("citations")
        .unwrap_or_else(|_| "[]".to_string());
    let citations: Vec<KnowledgeCitation> =
        serde_json::from_str(&citations_text).unwrap_or_default();

    Ok(KnowledgeQaMessageDto {
        id: row.try_get("id").unwrap_or_default(),
        series_id: row.try_get("series_id").unwrap_or_default(),
        role: row.try_get("role").unwrap_or_default(),
        content: row.try_get("content").unwrap_or_default(),
        citations,
        provider_type: row.try_get("provider_type").unwrap_or_default(),
        model_id: row.try_get("model_id").unwrap_or_default(),
        created_at: row.try_get("created_at").unwrap_or_default(),
    })
}

pub async fn insert_qa_message(
    pool: &SqlitePool,
    series_id: &str,
    role: &str,
    content: &str,
    citations: &[KnowledgeCitation],
    provider_type: &str,
    model_id: &str,
) -> Result<KnowledgeQaMessageDto, String> {
    let id = Uuid::new_v4().to_string();
    let citations_text = serde_json::to_string(citations).unwrap_or_else(|_| "[]".to_string());

    sqlx::query(
        r#"
        INSERT INTO knowledge_qa_messages (
            id, series_id, role, content, citations, provider_type, model_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(series_id)
    .bind(role)
    .bind(content)
    .bind(&citations_text)
    .bind(provider_type)
    .bind(model_id)
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(KnowledgeQaMessageDto {
        id,
        series_id: series_id.to_string(),
        role: role.to_string(),
        content: content.to_string(),
        citations: citations.to_vec(),
        provider_type: provider_type.to_string(),
        model_id: model_id.to_string(),
        created_at: String::new(),
    })
}

pub async fn clear_qa_messages(pool: &SqlitePool, series_id: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM knowledge_qa_messages WHERE series_id = ?")
        .bind(series_id)
        .execute(pool)
        .await
        .map(|_| ())
        .map_err(|error| error.to_string())
}
