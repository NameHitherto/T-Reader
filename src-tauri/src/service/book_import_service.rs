use std::path::Path;
use std::time::Duration;

use serde_json::Value;
use sqlx::SqlitePool;

use crate::{
    entities::{ImportBookResult, UpsertBookRequest},
    repository::{
        books::{get_book_by_key, upsert_book},
        local_fs::{
            dir_repository::{ensure_local_dirs, LOCAL_BOOKS_DIR, LOCAL_PROGRESS_DIR},
            file_repository::{copy_file, read_binary_file, write_binary_file},
        },
        webdav::{
            client::build_webdav_client,
            file_repository::download_remote_file,
        },
    },
    service::{
        book_identity::{build_book_key, build_book_title, hash_book_key},
        filesystem::{
            epub_meta_service::{parse_epub_metadata, EpubMetadata},
            settings_service::load_settings_entity,
            txt_to_epub_service::{convert_txt_bytes_to_epub, infer_txt_meta_from_filename},
        },
    },
    utils::logging::{log_info, log_warn},
    utils::webdav::is_txt_book_file,
};

/// 尝试从云端读取进度配置
async fn try_read_cloud_progress_config(
    pool: &SqlitePool,
    config_filename: &str,
) -> Result<Option<Value>, String> {
    // 加载设置
    let settings = match load_settings_entity(pool).await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    // 检查 WebDAV URL 是否配置
    let webdav_url = settings.webdav_url.trim();
    if webdav_url.is_empty() {
        return Ok(None);
    }

    // 云端检查超时与 WebDAV 请求超时保持一致，由用户在设置中配置
    let config_timeout = Duration::from_secs(settings.webdav_timeout_seconds.max(1) as u64);
    let client = build_webdav_client(settings.webdav_timeout_seconds, settings.proxy_enabled);

    // 使用 timeout 检查文件是否存在
    let exists_future = crate::service::webdav::file_service::webdav_file_exists(
        pool,
        "bookProgress",
        config_filename,
    );

    let exists = match tokio::time::timeout(config_timeout, exists_future).await
    {
        Ok(Ok(true)) => true,
        Ok(Ok(false)) => return Ok(None),
        Ok(Err(_)) => return Ok(None),
        Err(_) => {
            log_warn(
                "book-import",
                &format!("cloud-config-check-timeout file={}", config_filename),
            );
            return Ok(None);
        }
    };

    if !exists {
        return Ok(None);
    }

    // 下载云端配置
    let download_future = download_remote_file(
        &client,
        &settings,
        "bookProgress",
        config_filename,
    );

    match tokio::time::timeout(config_timeout, download_future).await
    {
        Ok(Ok(contents)) => {
            let config: Value = match serde_json::from_slice(&contents) {
                Ok(v) => v,
                Err(e) => {
                    log_warn(
                        "book-import",
                        &format!(
                            "cloud-config-parse-failed file={} error={}",
                            config_filename, e
                        ),
                    );
                    return Ok(None);
                }
            };
            Ok(Some(config))
        }
        Ok(Err(e)) => {
            log_warn(
                "book-import",
                &format!(
                    "cloud-config-download-failed file={} error={}",
                    config_filename, e
                ),
            );
            Ok(None)
        }
        Err(_) => {
            log_warn(
                "book-import",
                &format!("cloud-config-download-timeout file={}", config_filename),
            );
            Ok(None)
        }
    }
}

/// 导入书籍的核心逻辑
/// 1. 复制/转换源文件到本地 books/ 目录
/// 2. 解析元数据（title, author）
/// 3. 检查云端进度配置（如有则使用，否则创建初始配置）
/// 4. 写入本地进度配置
/// 5. 创建数据库记录
pub async fn import_book(
    pool: &SqlitePool,
    filepath: &str,
    filename: &str,
) -> Result<ImportBookResult, String> {
    let root_path = ensure_local_dirs()?;
    let books_path = root_path.join(LOCAL_BOOKS_DIR);
    let progress_path = root_path.join(LOCAL_PROGRESS_DIR);

    // 1. 复制/转换文件到本地 books/ 目录
    let (actual_file_name, file_bytes) = if is_txt_book_file(filename) {
        let source_path = Path::new(filepath);
        let txt_bytes = read_binary_file(source_path)?;
        let epub_file_name = convert_txt_bytes_to_epub(filename, &txt_bytes, &books_path)?;
        let epub_path = books_path.join(&epub_file_name);
        let epub_bytes = read_binary_file(&epub_path)?;
        log_info(
            "book-import",
            &format!(
                "converted-txt-to-epub source={} target={}",
                filename, epub_file_name
            ),
        );
        (epub_file_name, epub_bytes)
    } else {
        let source_path = Path::new(filepath);
        let target_path = books_path.join(filename);
        copy_file(source_path, &target_path)?;
        let file_bytes = read_binary_file(&target_path)?;
        log_info(
            "book-import",
            &format!(
                "copied-epub-file source={} target={}",
                filepath, filename
            ),
        );
        (filename.to_string(), file_bytes)
    };

    // 2. 解析元数据
    let meta = if is_txt_book_file(filename) {
        let inferred = infer_txt_meta_from_filename(filename);
        EpubMetadata {
            title: inferred.title,
            author: inferred.author,
        }
    } else {
        match parse_epub_metadata(&file_bytes) {
            Ok(meta) => meta,
            Err(error) => {
                log_warn(
                    "book-import",
                    &format!(
                        "parse-epub-meta-failed file={} error={}",
                        actual_file_name, error
                    ),
                );
                EpubMetadata {
                    title: Path::new(filename)
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("untitled")
                        .to_string(),
                    author: String::new(),
                }
            }
        }
    };

    let title = build_book_title(Some(&meta.title));
    let author = build_book_title(Some(&meta.author));
    let book_key = build_book_key(Some(&title), Some(&author));
    let cache_name = hash_book_key(&book_key);

    // 3. 检查数据库中是否已存在
    if let Some(existing) = get_book_by_key(pool, &book_key).await? {
        log_info(
            "book-import",
            &format!(
                "book-already-exists book_key={} file={}",
                book_key, actual_file_name
            ),
        );
        return Err(format!(
            "书籍 '{}' 已存在于书架中",
            existing.title
        ));
    }

    // 4. 检查云端进度配置并创建本地配置
    let config_filename = format!("{}.json", book_key);
    let config_path = progress_path.join(&config_filename);

    let (config_to_write, used_cloud_config) =
        match try_read_cloud_progress_config(pool, &config_filename).await? {
            Some(cloud_config) => {
                log_info(
                    "book-import",
                    &format!(
                        "use-cloud-config book_key={} file={}",
                        book_key, config_filename
                    ),
                );
                (cloud_config, true)
            }
            None => {
                let initial_config = serde_json::json!({
                    "name": title,
                    "author": author,
                    "durChapterIndex": 0,
                    "durChapterPos": 0,
                    "durChapterTitle": "",
                    "durChapterTime": 0,
                });
                log_info(
                    "book-import",
                    &format!(
                        "create-initial-config book_key={} file={}",
                        book_key, config_filename
                    ),
                );
                (initial_config, false)
            }
        };

    // 写入本地进度配置
    let config_bytes = serde_json::to_vec(&config_to_write)
        .map_err(|error| format!("序列化进度配置失败: {}", error))?;
    write_binary_file(&config_path, &config_bytes)?;
    log_info(
        "book-import",
        &format!(
            "progress-config-written book_key={} file={} used_cloud={}",
            book_key, config_filename, used_cloud_config
        ),
    );

    // 5. 创建数据库记录
    let stored_book = upsert_book(
        pool,
        UpsertBookRequest {
            book_key: Some(book_key.clone()),
            title: title.clone(),
            author: author.clone(),
            file_name: actual_file_name.clone(),
            format: Some("epub".to_string()),
            cache_name: Some(cache_name),
            has_cover: Some(true),
            cover_name: None,
            progress: Some(0.0),
        },
    )
    .await?;

    log_info(
        "book-import",
        &format!(
            "book-record-created book_key={} title={} author={} file={}",
            book_key, title, author, actual_file_name
        ),
    );

    Ok(ImportBookResult {
        book_key,
        title,
        author,
        file_name: actual_file_name,
        used_cloud_config,
        created_record: stored_book,
    })
}
