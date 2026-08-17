use std::{fs, path::Path};

use sha2::{Digest, Sha256};
use sqlx::SqlitePool;
use tauri::ipc::Channel;
use uuid::Uuid;

use crate::{
    entities::{KnowledgeChunkRecord, KnowledgeDocumentDto, KnowledgeIngestProgressEvent},
    repository::{
        knowledge_base as knowledge_repository,
        local_fs::{
            dir_repository::{LOCAL_KNOWLEDGE_DIR, ensure_local_dirs, get_local_root_dir},
            file_repository::{copy_file, read_binary_file},
        },
    },
    service::{
        filesystem::epub_meta_service::parse_epub_metadata,
        knowledge_base::{
            chunking::build_knowledge_chunks,
            epub_knowledge_extractor::extract_epub_knowledge_paragraphs,
            model_client::embed_texts,
            vector_store::{normalize_vector, vector_to_bytes},
        },
    },
    utils::logging::{log_error, log_info, log_warn},
};

pub async fn import_knowledge_documents(
    pool: &SqlitePool,
    series_id: &str,
    filepaths: &[String],
    on_event: &Channel<KnowledgeIngestProgressEvent>,
) -> Result<Vec<KnowledgeDocumentDto>, String> {
    if filepaths.is_empty() {
        return Err("请选择至少一个 EPUB 文件".to_string());
    }

    let root_path = ensure_local_dirs()?;
    let knowledge_dir = root_path.join(LOCAL_KNOWLEDGE_DIR);

    let mut results = Vec::new();
    for filepath in filepaths {
        let source_path = Path::new(filepath);
        let original_file_name = source_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("book.epub")
            .to_string();

        if !original_file_name.to_lowercase().ends_with(".epub") {
            return Err(format!("仅支持导入 EPUB 文件: {}", original_file_name));
        }

        let source_bytes = match read_binary_file(source_path) {
            Ok(bytes) => bytes,
            Err(error) => {
                log_error(
                    "knowledge-base",
                    &format!("read-import failed path={} error={}", filepath, error),
                );
                continue;
            }
        };

        let file_hash = format!("{:x}", Sha256::digest(&source_bytes));
        let stored_file_name = format!("{}.epub", Uuid::new_v4());
        let target_path = knowledge_dir.join(&stored_file_name);

        if let Err(error) = copy_file(source_path, &target_path) {
            log_error(
                "knowledge-base",
                &format!(
                    "copy-import failed source={} target={} error={}",
                    filepath,
                    target_path.display(),
                    error
                ),
            );
            continue;
        }

        let (title, author) = parse_epub_metadata(&source_bytes)
            .map(|metadata| (metadata.title, metadata.author))
            .unwrap_or_else(|_| {
                (
                    Path::new(&original_file_name)
                        .file_stem()
                        .and_then(|value| value.to_str())
                        .unwrap_or("untitled")
                        .to_string(),
                    String::new(),
                )
            });

        let document = match knowledge_repository::insert_document(
            pool,
            series_id,
            &original_file_name,
            &stored_file_name,
            &file_hash,
            &title,
            &author,
        )
        .await
        {
            Ok(document) => document,
            Err(error) => {
                log_error(
                    "knowledge-base",
                    &format!("insert-document failed error={}", error),
                );
                let _ = fs::remove_file(&target_path);
                continue;
            }
        };

        match ingest_document(pool, &document.id, on_event).await {
            Ok(ready_document) => results.push(ready_document),
            Err(error) => {
                log_error(
                    "knowledge-base",
                    &format!("ingest failed document={} error={}", document.id, error),
                );
                match knowledge_repository::set_document_error(pool, &document.id, &error).await {
                    Ok(error_document) => results.push(error_document),
                    Err(_) => {}
                }
            }
        }
    }

    Ok(results)
}

pub async fn ingest_document(
    pool: &SqlitePool,
    document_id: &str,
    on_event: &Channel<KnowledgeIngestProgressEvent>,
) -> Result<KnowledgeDocumentDto, String> {
    let document = knowledge_repository::get_document(pool, document_id)
        .await?
        .ok_or_else(|| format!("知识库文档不存在: {}", document_id))?;

    knowledge_repository::set_document_ingesting(pool, document_id).await?;
    send_progress(on_event, document_id, "parsing", 0, 0, "正在解析 EPUB 正文");

    let file_path = get_local_root_dir()?
        .join(LOCAL_KNOWLEDGE_DIR)
        .join(&document.stored_file_name);
    let bytes = read_binary_file(&file_path)?;

    let paragraphs = extract_epub_knowledge_paragraphs(&bytes)?;
    send_progress(
        on_event,
        document_id,
        "chunking",
        0,
        0,
        "正在按段落结构划分文本块",
    );

    let chunks = build_knowledge_chunks(&paragraphs)?;
    let total_chunks = chunks.len() as i64;
    let char_count = chunks
        .iter()
        .map(|chunk| chunk.content.chars().count() as i64)
        .sum();

    let contents: Vec<String> = chunks.iter().map(|chunk| chunk.content.clone()).collect();
    send_progress(
        on_event,
        document_id,
        "embedding",
        0,
        total_chunks,
        "正在生成文本向量",
    );

    let embeddings = embed_texts(pool, &contents).await?;
    if embeddings.len() != chunks.len() {
        return Err("嵌入结果数量与文本块数量不一致".to_string());
    }

    let mut chunk_records = Vec::with_capacity(chunks.len());
    for (index, chunk) in chunks.into_iter().enumerate() {
        let mut vector = embeddings[index].clone();
        normalize_vector(&mut vector);

        chunk_records.push(KnowledgeChunkRecord {
            id: Uuid::new_v4().to_string(),
            series_id: document.series_id.clone(),
            document_id: document.id.clone(),
            chapter_index: chunk.chapter_index,
            chapter_title: chunk.chapter_title,
            paragraph_index: chunk.paragraph_index,
            content: chunk.content,
            vector: vector_to_bytes(&vector),
            embedding_model: String::new(),
        });

        let processed = (index + 1) as i64;
        if processed % 8 == 0 || processed == total_chunks {
            send_progress(
                on_event,
                document_id,
                "embedding",
                processed,
                total_chunks,
                "正在写入向量索引",
            );
        }
    }

    knowledge_repository::replace_chunks(pool, &chunk_records).await?;
    send_progress(
        on_event,
        document_id,
        "done",
        total_chunks,
        total_chunks,
        "索引完成",
    );

    let ready =
        knowledge_repository::set_document_ready(pool, document_id, char_count, total_chunks)
            .await?;
    log_info(
        "knowledge-base",
        &format!(
            "ingest-complete document={} chunks={}",
            document_id, total_chunks
        ),
    );
    Ok(ready)
}

pub async fn reingest_document(
    pool: &SqlitePool,
    document_id: &str,
    on_event: &Channel<KnowledgeIngestProgressEvent>,
) -> Result<KnowledgeDocumentDto, String> {
    if knowledge_repository::get_document(pool, document_id)
        .await?
        .is_none()
    {
        return Err(format!("知识库文档不存在: {}", document_id));
    }

    match ingest_document(pool, document_id, on_event).await {
        Ok(ready) => Ok(ready),
        Err(error) => {
            knowledge_repository::set_document_error(pool, document_id, &error).await?;
            Err(error)
        }
    }
}

pub async fn delete_document(pool: &SqlitePool, document_id: &str) -> Result<(), String> {
    let document = knowledge_repository::get_document(pool, document_id).await?;
    knowledge_repository::delete_document(pool, document_id).await?;

    if let Some(document) = document {
        let file_path = get_local_root_dir()?
            .join(LOCAL_KNOWLEDGE_DIR)
            .join(&document.stored_file_name);
        if file_path.exists() {
            if let Err(error) = fs::remove_file(&file_path) {
                log_warn(
                    "knowledge-base",
                    &format!(
                        "remove-document-file failed path={} error={}",
                        file_path.display(),
                        error
                    ),
                );
            }
        }
    }

    log_info(
        "knowledge-base",
        &format!("deleted document={}", document_id),
    );
    Ok(())
}

fn send_progress(
    channel: &Channel<KnowledgeIngestProgressEvent>,
    document_id: &str,
    stage: &str,
    processed_chunks: i64,
    total_chunks: i64,
    message: &str,
) {
    let _ = channel.send(KnowledgeIngestProgressEvent {
        document_id: document_id.to_string(),
        stage: stage.to_string(),
        processed_chunks,
        total_chunks,
        message: message.to_string(),
    });
}
