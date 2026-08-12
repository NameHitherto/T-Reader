use std::collections::{BTreeSet, HashMap};
use std::path::Path;

use sqlx::SqlitePool;

use crate::{
    entities::{
        webdav_error::WebDavError, CloudSyncApplyRequest, CloudSyncApplyResult,
        CloudSyncBookAction, CloudSyncBookSelection, CloudSyncBookStatus, CloudSyncPreviewItem,
        CloudSyncPreviewResult, Settings, UpsertBookRequest,
    },
    repository::{
        books::{get_book_by_key, upsert_book},
        local_fs::{
            dir_repository::{ensure_local_dirs, CLOUD_BOOKS_DIR, CLOUD_PROGRESS_DIR},
            file_repository::{list_files, read_binary_file, write_binary_file},
        },
        webdav::{
            client::build_webdav_client,
            file_repository::{download_remote_file, list_remote_files, upload_remote_file},
        },
    },
    service::{
        book_identity::build_book_key,
        filesystem::{
            epub_meta_service::parse_epub_metadata,
            settings_service::load_settings_entity,
            txt_to_epub_service::{convert_txt_bytes_to_epub, infer_txt_meta_from_filename, to_epub_file_name},
        },
        webdav::dir_service::ensure_cloud_dirs,
    },
    utils::{
        logging::{finish_timer, log_info, log_warn, start_timer},
        webdav::{
            is_config_file, is_supported_book_file, is_txt_book_file, should_upload_local_config,
        },
    },
};

struct SyncSnapshot {
    settings: Settings,
    client: reqwest::Client,
    books_path: std::path::PathBuf,
    progress_path: std::path::PathBuf,
    local_books: BTreeSet<String>,
    cloud_books: BTreeSet<String>,
    local_configs: BTreeSet<String>,
    cloud_configs: BTreeSet<String>,
}

fn collect_local_files(
    dir_path: &std::path::Path,
    filter: fn(&str) -> bool,
) -> Result<BTreeSet<String>, WebDavError> {
    Ok(list_files(dir_path)
        .map_err(|error| WebDavError {
            status_code: 0,
            operation: "list".to_string(),
            resource: dir_path.to_string_lossy().to_string(),
            message: error,
        })?
        .into_iter()
        .filter(|file_name| filter(file_name))
        .collect())
}

async fn collect_remote_files(
    client: &reqwest::Client,
    settings: &Settings,
    subdir: &str,
    filter: fn(&str) -> bool,
) -> Result<BTreeSet<String>, WebDavError> {
    Ok(list_remote_files(client, settings, subdir)
        .await?
        .into_iter()
        .filter(|file_name| filter(file_name))
        .collect())
}

async fn collect_sync_snapshot(pool: &SqlitePool) -> Result<SyncSnapshot, WebDavError> {
    let settings = load_settings_entity(pool).await.map_err(|error| WebDavError {
        status_code: 0,
        operation: "list".to_string(),
        resource: "settings".to_string(),
        message: error,
    })?;
    let client = build_webdav_client(settings.webdav_timeout_seconds);

    ensure_cloud_dirs(&settings).await.map_err(|error| WebDavError {
        status_code: 0,
        operation: "list".to_string(),
        resource: "cloud_dirs".to_string(),
        message: error,
    })?;
    let root_path = ensure_local_dirs().map_err(|error| WebDavError {
        status_code: 0,
        operation: "list".to_string(),
        resource: "local_dirs".to_string(),
        message: error,
    })?;

    let books_path = root_path.join(CLOUD_BOOKS_DIR);
    let progress_path = root_path.join(CLOUD_PROGRESS_DIR);

    let local_books = collect_local_files(&books_path, is_supported_book_file)?;
    let cloud_books =
        collect_remote_files(&client, &settings, CLOUD_BOOKS_DIR, is_supported_book_file).await?;

    let local_configs = collect_local_files(&progress_path, is_config_file)?;
    let cloud_configs =
        collect_remote_files(&client, &settings, CLOUD_PROGRESS_DIR, is_config_file).await?;

    log_info(
        "webdav",
        &format!(
            "sync-snapshot local_books={} cloud_books={} local_configs={} cloud_configs={}",
            local_books.len(),
            cloud_books.len(),
            local_configs.len(),
            cloud_configs.len()
        ),
    );

    Ok(SyncSnapshot {
        settings,
        client,
        books_path,
        progress_path,
        local_books,
        cloud_books,
        local_configs,
        cloud_configs,
    })
}

fn resolve_book_status(local_exists: bool, cloud_exists: bool) -> CloudSyncBookStatus {
    match (local_exists, cloud_exists) {
        (true, true) => CloudSyncBookStatus::Normal,
        (true, false) => CloudSyncBookStatus::Upload,
        (false, true) => CloudSyncBookStatus::Download,
        (false, false) => CloudSyncBookStatus::Normal,
    }
}

fn resolve_local_book_exists(snapshot: &SyncSnapshot, file_name: &str, cloud_exists: bool) -> bool {
    if snapshot.local_books.contains(file_name) {
        return true;
    }

    if cloud_exists && is_txt_book_file(file_name) {
        let epub_name = to_epub_file_name(file_name);
        return snapshot.local_books.contains(&epub_name);
    }

    false
}

fn build_preview_result(snapshot: &SyncSnapshot) -> CloudSyncPreviewResult {
    let mut normal_count = 0;
    let mut upload_count = 0;
    let mut download_count = 0;
    let mut book_items = Vec::new();

    for file_name in snapshot.local_books.union(&snapshot.cloud_books) {
        let cloud_exists = snapshot.cloud_books.contains(file_name);
        let local_exists = resolve_local_book_exists(snapshot, file_name, cloud_exists);
        let status = resolve_book_status(local_exists, cloud_exists);

        match status {
            CloudSyncBookStatus::Normal => {
                normal_count += 1;
            }
            CloudSyncBookStatus::Upload => {
                upload_count += 1;
                book_items.push(CloudSyncPreviewItem {
                    file_name: file_name.clone(),
                    local_exists,
                    cloud_exists,
                    status,
                });
            }
            CloudSyncBookStatus::Download => {
                download_count += 1;
                book_items.push(CloudSyncPreviewItem {
                    file_name: file_name.clone(),
                    local_exists,
                    cloud_exists,
                    status,
                });
            }
        }
    }

    CloudSyncPreviewResult {
        book_items,
        normal_count,
        upload_count,
        download_count,
    }
}

fn book_action_matches_status(action: &CloudSyncBookAction, status: &CloudSyncBookStatus) -> bool {
    matches!(
        (action, status),
        (CloudSyncBookAction::Upload, CloudSyncBookStatus::Upload)
            | (CloudSyncBookAction::Download, CloudSyncBookStatus::Download)
    )
}

fn dedupe_book_selections(selections: &[CloudSyncBookSelection]) -> Vec<CloudSyncBookSelection> {
    let mut selection_map = HashMap::new();

    for selection in selections {
        selection_map.insert(selection.file_name.clone(), selection.action.clone());
    }

    let mut normalized: Vec<CloudSyncBookSelection> = selection_map
        .into_iter()
        .map(|(file_name, action)| CloudSyncBookSelection { file_name, action })
        .collect();
    normalized.sort_by(|left, right| left.file_name.cmp(&right.file_name));
    normalized
}

/// 从已下载的书籍文件中解析元数据并创建数据库记录
/// 如果数据库中已存在该书籍（通过 book_key 判断），则跳过
async fn auto_import_downloaded_book(
    pool: &SqlitePool,
    progress_path: &Path,
    file_name: &str,
    file_contents: &[u8],
) -> Result<(), String> {
    // 解析书籍元数据
    let meta = if is_txt_book_file(file_name) {
        let inferred = infer_txt_meta_from_filename(file_name);
        crate::service::filesystem::epub_meta_service::EpubMetadata {
            title: inferred.title,
            author: inferred.author,
        }
    } else {
        parse_epub_metadata(file_contents).map_err(|error| {
            log_warn(
                "webdav",
                &format!(
                    "auto-import parse-epub-meta-failed file={} error={}",
                    file_name, error
                ),
            );
            error
        })?
    };

    let title = crate::service::book_identity::build_book_title(Some(&meta.title));
    let author = crate::service::book_identity::build_book_title(Some(&meta.author));
    let book_key = build_book_key(Some(&title), Some(&author));

    // 检查数据库中是否已存在
    let existing = get_book_by_key(pool, &book_key).await?;
    if existing.is_some() {
        log_info(
            "webdav",
            &format!(
                "auto-import book-already-exists book_key={} file={}",
                book_key, file_name
            ),
        );
        return Ok(());
    }

    let cache_name = crate::service::book_identity::hash_book_key(&book_key);

    upsert_book(
        pool,
        UpsertBookRequest {
            book_key: Some(book_key.clone()),
            title: title.clone(),
            author: author.clone(),
            file_name: file_name.to_string(),
            format: Some("epub".to_string()),
            cache_name: Some(cache_name),
            has_cover: Some(true),
            cover_name: None,
            progress: Some(0.0),
        },
    )
    .await?;

    log_info(
        "webdav",
        &format!(
            "auto-import book-record-created book_key={} title={} author={} file={}",
            book_key, title, author, file_name
        ),
    );

    // 创建初始进度配置文件（如果不存在）
    let config_file_name = format!("{}.json", book_key);
    let config_path = progress_path.join(&config_file_name);
    if !config_path.exists() {
        let initial_config = serde_json::json!({
            "name": title,
            "author": author,
            "durChapterIndex": 0,
            "durChapterPos": 0,
            "durChapterTitle": "",
            "durChapterTime": 0,
        });
        let config_bytes = serde_json::to_vec(&initial_config).map_err(|error| error.to_string())?;
        write_binary_file(&config_path, &config_bytes)?;
        log_info(
            "webdav",
            &format!(
                "auto-import progress-config-created book_key={} file={}",
                book_key, config_file_name
            ),
        );
    }

    Ok(())
}

async fn sync_book_files(
    snapshot: &SyncSnapshot,
    selections: &[CloudSyncBookSelection],
    result: &mut CloudSyncApplyResult,
    pool: &SqlitePool,
) -> Result<(), WebDavError> {
    for selection in dedupe_book_selections(selections) {
        let cloud_exists = snapshot.cloud_books.contains(&selection.file_name);
        let local_exists = resolve_local_book_exists(snapshot, &selection.file_name, cloud_exists);
        let status = resolve_book_status(local_exists, cloud_exists);

        if !book_action_matches_status(&selection.action, &status) {
            result.skipped_count += 1;
            continue;
        }

        match selection.action {
            CloudSyncBookAction::Upload => {
                let local_path = snapshot.books_path.join(&selection.file_name);
                let contents = read_binary_file(&local_path).map_err(|error| WebDavError {
                    status_code: 0,
                    operation: "upload".to_string(),
                    resource: selection.file_name.clone(),
                    message: error,
                })?;
                upload_remote_file(
                    &snapshot.client,
                    &snapshot.settings,
                    CLOUD_BOOKS_DIR,
                    &selection.file_name,
                    contents,
                )
                .await?;
                result.uploaded_book_count += 1;
            }
            CloudSyncBookAction::Download => {
                let contents = download_remote_file(
                    &snapshot.client,
                    &snapshot.settings,
                    CLOUD_BOOKS_DIR,
                    &selection.file_name,
                )
                .await?;

                let actual_file_name = if is_txt_book_file(&selection.file_name) {
                    let target_file = convert_txt_bytes_to_epub(
                        &selection.file_name,
                        &contents,
                        &snapshot.books_path,
                    ).map_err(|error| WebDavError {
                        status_code: 0,
                        operation: "download".to_string(),
                        resource: selection.file_name.clone(),
                        message: error,
                    })?;
                    log_info(
                        "webdav",
                        &format!(
                            "sync-book-files converted-txt source={} target={}",
                            selection.file_name, target_file
                        ),
                    );
                    target_file
                } else {
                    write_binary_file(&snapshot.books_path.join(&selection.file_name), &contents)
                        .map_err(|error| WebDavError {
                            status_code: 0,
                            operation: "download".to_string(),
                            resource: selection.file_name.clone(),
                            message: error,
                        })?;
                    selection.file_name.clone()
                };

                result.downloaded_book_count += 1;

                // 自动导入：解析元数据并创建数据库记录
                if let Err(error) =
                    auto_import_downloaded_book(pool, &snapshot.progress_path, &actual_file_name, &contents).await
                {
                    log_warn(
                        "webdav",
                        &format!(
                            "sync-book-files auto-import-failed file={} error={}",
                            actual_file_name, error
                        ),
                    );
                }
            }
        }
    }

    Ok(())
}

async fn sync_config_files(
    snapshot: &SyncSnapshot,
    result: &mut CloudSyncApplyResult,
) -> Result<(), WebDavError> {
    for file_name in snapshot.local_configs.difference(&snapshot.cloud_configs) {
        let contents = read_binary_file(&snapshot.progress_path.join(file_name)).map_err(|error| WebDavError {
            status_code: 0,
            operation: "upload".to_string(),
            resource: file_name.clone(),
            message: error,
        })?;
        upload_remote_file(
            &snapshot.client,
            &snapshot.settings,
            CLOUD_PROGRESS_DIR,
            file_name,
            contents,
        )
        .await?;
        result.uploaded_config_count += 1;
    }

    for file_name in snapshot.cloud_configs.difference(&snapshot.local_configs) {
        let contents = download_remote_file(
            &snapshot.client,
            &snapshot.settings,
            CLOUD_PROGRESS_DIR,
            file_name,
        )
        .await?;
        write_binary_file(&snapshot.progress_path.join(file_name), &contents).map_err(|error| WebDavError {
            status_code: 0,
            operation: "download".to_string(),
            resource: file_name.clone(),
            message: error,
        })?;
        result.downloaded_config_count += 1;
    }

    for file_name in snapshot.local_configs.intersection(&snapshot.cloud_configs) {
        let local_path = snapshot.progress_path.join(file_name);
        let local_contents = read_binary_file(&local_path).map_err(|error| WebDavError {
            status_code: 0,
            operation: "download".to_string(),
            resource: file_name.clone(),
            message: error,
        })?;
        let cloud_contents = download_remote_file(
            &snapshot.client,
            &snapshot.settings,
            CLOUD_PROGRESS_DIR,
            file_name,
        )
        .await?;

        if local_contents == cloud_contents {
            continue;
        }

        if should_upload_local_config(&local_contents, &cloud_contents) {
            upload_remote_file(
                &snapshot.client,
                &snapshot.settings,
                CLOUD_PROGRESS_DIR,
                file_name,
                local_contents,
            )
            .await?;
            result.uploaded_config_count += 1;
            result.replaced_config_count += 1;
        } else {
            write_binary_file(&local_path, &cloud_contents).map_err(|error| WebDavError {
                status_code: 0,
                operation: "download".to_string(),
                resource: file_name.clone(),
                message: error,
            })?;
            result.downloaded_config_count += 1;
            result.replaced_config_count += 1;
        }
    }

    Ok(())
}

async fn apply_sync_plan_with_snapshot(
    snapshot: SyncSnapshot,
    request: CloudSyncApplyRequest,
    pool: &SqlitePool,
) -> Result<CloudSyncApplyResult, WebDavError> {
    let mut result = CloudSyncApplyResult::default();

    sync_book_files(&snapshot, &request.book_selections, &mut result, pool).await?;
    sync_config_files(&snapshot, &mut result).await?;

    Ok(result)
}

fn build_legacy_request(snapshot: &SyncSnapshot) -> CloudSyncApplyRequest {
    let mut book_selections = Vec::new();

    for file_name in snapshot.local_books.union(&snapshot.cloud_books) {
        let cloud_exists = snapshot.cloud_books.contains(file_name);
        let local_exists = resolve_local_book_exists(snapshot, file_name, cloud_exists);
        let status = resolve_book_status(local_exists, cloud_exists);

        match status {
            CloudSyncBookStatus::Upload => book_selections.push(CloudSyncBookSelection {
                file_name: file_name.clone(),
                action: CloudSyncBookAction::Upload,
            }),
            CloudSyncBookStatus::Download => book_selections.push(CloudSyncBookSelection {
                file_name: file_name.clone(),
                action: CloudSyncBookAction::Download,
            }),
            CloudSyncBookStatus::Normal => {}
        }
    }

    CloudSyncApplyRequest { book_selections }
}

pub async fn webdav_get_sync_preview(pool: &SqlitePool) -> Result<CloudSyncPreviewResult, WebDavError> {
    let started_at = start_timer("webdav", "webdav-get-sync-preview");
    let snapshot = collect_sync_snapshot(pool).await?;
    let result = build_preview_result(&snapshot);
    finish_timer("webdav", "webdav-get-sync-preview", started_at);
    Ok(result)
}

pub async fn webdav_apply_sync_plan(
    pool: &SqlitePool,
    request: CloudSyncApplyRequest,
) -> Result<CloudSyncApplyResult, WebDavError> {
    let started_at = start_timer("webdav", "webdav-apply-sync-plan");
    let snapshot = collect_sync_snapshot(pool).await?;
    let result = apply_sync_plan_with_snapshot(snapshot, request, pool).await?;
    finish_timer("webdav", "webdav-apply-sync-plan", started_at);
    Ok(result)
}

pub async fn webdav_sync_files(pool: &SqlitePool) -> Result<(), WebDavError> {
    let started_at = start_timer("webdav", "webdav-sync-files");
    let snapshot = collect_sync_snapshot(pool).await?;
    let request = build_legacy_request(&snapshot);
    apply_sync_plan_with_snapshot(snapshot, request, pool).await?;
    finish_timer("webdav", "webdav-sync-files", started_at);
    Ok(())
}
