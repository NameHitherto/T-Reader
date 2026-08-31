use std::collections::{BTreeSet, HashMap};
use std::path::Path;

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::{
    entities::{
        webdav_error::WebDavError, CloudSyncApplyRequest, CloudSyncApplyResult,
        CloudSyncBookAction, CloudSyncBookSelection, CloudSyncBookStatus, CloudSyncPreviewItem,
        CloudSyncPreviewResult, ReconcileProgressConfigsResult, Settings, UpsertBookRequest,
    },
    repository::{
        books::{get_book_by_key, upsert_book},
        local_fs::{
            dir_repository::{ensure_local_dirs, CLOUD_BOOKS_DIR, CLOUD_PROGRESS_DIR, LOCAL_CACHED_DIR},
            file_repository::{list_files, read_binary_file, write_binary_file},
        },
        webdav::{
            client::build_webdav_client,
            file_repository::{
                download_remote_file, list_remote_files, list_remote_files_with_meta,
                upload_remote_file,
            },
        },
    },
    service::{
        book_identity::build_book_key,
        fs::{
            epub_meta_service::parse_epub_metadata,
            settings_service::load_settings_entity,
            txt_to_epub_service::{convert_txt_bytes_to_epub, infer_txt_meta_from_filename, to_epub_file_name},
        },
        webdav::dir_service::ensure_cloud_dirs,
    },
    utils::{
        logging::{log_info, log_warn},
        webdav::{
            is_config_file, is_supported_book_file, is_txt_book_file, read_dur_chapter_time,
            should_upload_local_config, RemoteFileMeta,
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
    cloud_config_metas: HashMap<String, RemoteFileMeta>,
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

async fn collect_remote_file_metas(
    client: &reqwest::Client,
    settings: &Settings,
    subdir: &str,
    filter: fn(&str) -> bool,
) -> Result<HashMap<String, RemoteFileMeta>, WebDavError> {
    Ok(list_remote_files_with_meta(client, settings, subdir)
        .await?
        .into_iter()
        .filter(|meta| filter(&meta.file_name))
        .map(|meta| (meta.file_name.clone(), meta))
        .collect())
}

async fn collect_sync_snapshot(pool: &SqlitePool) -> Result<SyncSnapshot, WebDavError> {
    let settings = load_settings_entity(pool).await.map_err(|error| WebDavError {
        status_code: 0,
        operation: "list".to_string(),
        resource: "settings".to_string(),
        message: error,
    })?;
    let client = build_webdav_client(settings.webdav_timeout_seconds, settings.proxy_enabled);

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
    let cloud_config_metas =
        collect_remote_file_metas(&client, &settings, CLOUD_PROGRESS_DIR, is_config_file).await?;
    let cloud_configs: BTreeSet<String> = cloud_config_metas.keys().cloned().collect();

    log_info(
        "webdav-sync",
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
        cloud_config_metas,
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
        crate::service::fs::epub_meta_service::EpubMetadata {
            title: inferred.title,
            author: inferred.author,
        }
    } else {
        parse_epub_metadata(file_contents).map_err(|error| {
            log_warn(
                "webdav-sync",
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
            "webdav-sync",
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
        "webdav-sync",
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
            "webdav-sync",
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
                        "webdav-sync",
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
                        "webdav-sync",
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
    let cached_dir = snapshot
        .progress_path
        .parent()
        .map(|root| root.join(LOCAL_CACHED_DIR))
        .unwrap_or_else(|| snapshot.progress_path.join(LOCAL_CACHED_DIR));
    let mut cache = load_progress_meta_cache(&cached_dir);

    // 本地独有 → 上传
    for file_name in snapshot.local_configs.difference(&snapshot.cloud_configs) {
        let contents = read_binary_file(&snapshot.progress_path.join(file_name)).map_err(|error| WebDavError {
            status_code: 0,
            operation: "upload".to_string(),
            resource: file_name.clone(),
            message: error,
        })?;
        let local_time = read_dur_chapter_time(&contents);
        upload_remote_file(
            &snapshot.client,
            &snapshot.settings,
            CLOUD_PROGRESS_DIR,
            file_name,
            contents,
        )
        .await?;
        cache.insert(
            file_name.clone(),
            CloudProgressMeta {
                etag: None,
                last_modified: None,
                dur_chapter_time: local_time,
            },
        );
        result.uploaded_config_count += 1;
    }

    // 云端独有 → 下载
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
        let cloud_meta = snapshot
            .cloud_config_metas
            .get(file_name)
            .map(|meta| meta_from_remote(meta, &contents))
            .unwrap_or_default();
        cache.insert(file_name.clone(), cloud_meta);
        result.downloaded_config_count += 1;
    }

    // 两边都存在 → 用元数据跳过未变化配置，仅对变化/无法判定者下载比较
    for file_name in snapshot.local_configs.intersection(&snapshot.cloud_configs) {
        let local_path = snapshot.progress_path.join(file_name);
        let local_contents = read_binary_file(&local_path).map_err(|error| WebDavError {
            status_code: 0,
            operation: "download".to_string(),
            resource: file_name.clone(),
            message: error,
        })?;
        let local_time = read_dur_chapter_time(&local_contents);
        let remote_meta = snapshot.cloud_config_metas.get(file_name);

        if let (Some(cached), Some(meta)) = (cache.get(file_name), remote_meta) {
            if cloud_meta_unchanged(cached, meta) {
                if local_is_newer_than_cached(local_time, cached.dur_chapter_time) {
                    upload_remote_file(
                        &snapshot.client,
                        &snapshot.settings,
                        CLOUD_PROGRESS_DIR,
                        file_name,
                        local_contents,
                    )
                    .await?;
                    cache.insert(
                        file_name.clone(),
                        CloudProgressMeta {
                            etag: None,
                            last_modified: None,
                            dur_chapter_time: local_time,
                        },
                    );
                    result.uploaded_config_count += 1;
                    result.replaced_config_count += 1;
                }
                continue;
            }
        }

        let cloud_contents = download_remote_file(
            &snapshot.client,
            &snapshot.settings,
            CLOUD_PROGRESS_DIR,
            file_name,
        )
        .await?;

        if local_contents == cloud_contents {
            if let Some(meta) = remote_meta {
                cache.insert(file_name.clone(), meta_from_remote(meta, &cloud_contents));
            }
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
            cache.insert(
                file_name.clone(),
                CloudProgressMeta {
                    etag: None,
                    last_modified: None,
                    dur_chapter_time: local_time,
                },
            );
            result.uploaded_config_count += 1;
            result.replaced_config_count += 1;
        } else {
            write_binary_file(&local_path, &cloud_contents).map_err(|error| WebDavError {
                status_code: 0,
                operation: "download".to_string(),
                resource: file_name.clone(),
                message: error,
            })?;
            if let Some(meta) = remote_meta {
                cache.insert(file_name.clone(), meta_from_remote(meta, &cloud_contents));
            }
            result.downloaded_config_count += 1;
            result.replaced_config_count += 1;
        }
    }

    save_progress_meta_cache(&cached_dir, &cache);

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
    let snapshot = collect_sync_snapshot(pool).await?;
    let result = build_preview_result(&snapshot);
    log_info("webdav-sync", "get-sync-preview-done");
    Ok(result)
}

pub async fn webdav_apply_sync_plan(
    pool: &SqlitePool,
    request: CloudSyncApplyRequest,
) -> Result<CloudSyncApplyResult, WebDavError> {
    let snapshot = collect_sync_snapshot(pool).await?;
    let result = apply_sync_plan_with_snapshot(snapshot, request, pool).await?;
    log_info("webdav-sync", "apply-sync-plan-done");
    Ok(result)
}

pub async fn webdav_sync_files(pool: &SqlitePool) -> Result<(), WebDavError> {
    let snapshot = collect_sync_snapshot(pool).await?;
    let request = build_legacy_request(&snapshot);
    apply_sync_plan_with_snapshot(snapshot, request, pool).await?;
    log_info("webdav-sync", "sync-files-done");
    Ok(())
}

// ============================================================
// 进度配置后台对账（本地优先 + 元数据变更检测）
// ============================================================

const CLOUD_PROGRESS_META_FILE: &str = "cloud-progress-meta.json";

/// 单个进度配置最近一次同步时记录下的云端状态。
#[derive(Default, Clone, Serialize, Deserialize)]
struct CloudProgressMeta {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    etag: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    last_modified: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    dur_chapter_time: Option<i64>,
}

type ProgressMetaCache = HashMap<String, CloudProgressMeta>;

fn load_progress_meta_cache(cached_dir: &Path) -> ProgressMetaCache {
    let path = cached_dir.join(CLOUD_PROGRESS_META_FILE);
    match read_binary_file(&path) {
        Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_default(),
        Err(_) => HashMap::new(),
    }
}

fn save_progress_meta_cache(cached_dir: &Path, cache: &ProgressMetaCache) {
    let path = cached_dir.join(CLOUD_PROGRESS_META_FILE);
    match serde_json::to_vec(cache) {
        Ok(bytes) => {
            if let Err(error) = write_binary_file(&path, &bytes) {
                log_warn(
                    "webdav-sync",
                    &format!("save-cloud-progress-meta-cache failed error={}", error),
                );
            }
        }
        Err(error) => {
            log_warn(
                "webdav-sync",
                &format!("serialize-cloud-progress-meta-cache failed error={}", error),
            );
        }
    }
}

/// 判断缓存的云端元数据与当前 PROPFIND 元数据是否一致（内容未变化）。
fn cloud_meta_unchanged(cached: &CloudProgressMeta, meta: &RemoteFileMeta) -> bool {
    if let (Some(cached_etag), Some(meta_etag)) = (&cached.etag, &meta.etag) {
        return cached_etag == meta_etag;
    }
    if let (Some(cached_lm), Some(meta_lm)) = (&cached.last_modified, &meta.last_modified) {
        return cached_lm == meta_lm;
    }
    false
}

/// 本地是否比「最近一次同步时的云端」更新。语义与 `should_upload_local_config` 一致。
fn local_is_newer_than_cached(local: Option<i64>, cached_cloud: Option<i64>) -> bool {
    match (local, cached_cloud) {
        (Some(local), Some(cloud)) => local > cloud,
        (Some(_), None) => true,
        (None, _) => false,
    }
}

fn meta_from_remote(meta: &RemoteFileMeta, contents: &[u8]) -> CloudProgressMeta {
    CloudProgressMeta {
        etag: meta.etag.clone(),
        last_modified: meta.last_modified.clone(),
        dur_chapter_time: read_dur_chapter_time(contents),
    }
}

/// 后台进度配置对账：一次 PROPFIND 列出云端元数据，仅对发生变化/本地缺失/无元数据的
/// 配置执行正文下载；本地较新者上传。单个文件失败只记日志，不中断整批。
pub async fn webdav_reconcile_progress_configs(
    pool: &SqlitePool,
) -> Result<ReconcileProgressConfigsResult, WebDavError> {
    let settings = load_settings_entity(pool).await.map_err(|error| WebDavError {
        status_code: 0,
        operation: "list".to_string(),
        resource: "settings".to_string(),
        message: error,
    })?;
    let client = build_webdav_client(settings.webdav_timeout_seconds, settings.proxy_enabled);

    ensure_cloud_dirs(&settings)
        .await
        .map_err(|error| WebDavError {
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

    let progress_path = root_path.join(CLOUD_PROGRESS_DIR);
    let cached_path = root_path.join(LOCAL_CACHED_DIR);

    let local_configs = collect_local_files(&progress_path, is_config_file)?;
    let remote_metas =
        list_remote_files_with_meta(&client, &settings, CLOUD_PROGRESS_DIR).await?;
    let remote_configs: BTreeSet<String> = remote_metas
        .iter()
        .filter(|meta| is_config_file(&meta.file_name))
        .map(|meta| meta.file_name.clone())
        .collect();

    let mut cache = load_progress_meta_cache(&cached_path);
    let mut result = ReconcileProgressConfigsResult::default();

    for file_name in local_configs.union(&remote_configs) {
        let local_path = progress_path.join(file_name);
        let local_exists = local_configs.contains(file_name);
        let remote_meta = remote_metas.iter().find(|meta| meta.file_name == *file_name);

        match (local_exists, remote_meta) {
            // 云端缺失、本地存在 → 上传本地
            (true, None) => {
                let contents = match read_binary_file(&local_path) {
                    Ok(contents) => contents,
                    Err(error) => {
                        log_warn(
                            "webdav-sync",
                            &format!(
                                "reconcile-read-local-failed file={} error={}",
                                file_name, error
                            ),
                        );
                        continue;
                    }
                };
                let local_time = read_dur_chapter_time(&contents);
                if let Err(error) =
                    upload_remote_file(&client, &settings, CLOUD_PROGRESS_DIR, file_name, contents)
                        .await
                {
                    log_warn(
                        "webdav-sync",
                        &format!(
                            "reconcile-upload-failed file={} error={}",
                            file_name, error.message
                        ),
                    );
                    continue;
                }
                cache.insert(
                    file_name.clone(),
                    CloudProgressMeta {
                        etag: None,
                        last_modified: None,
                        dur_chapter_time: local_time,
                    },
                );
                result.pushed_files.push(file_name.clone());
            }
            // 本地缺失、云端存在 → 下载
            (false, Some(meta)) => {
                match download_remote_file(&client, &settings, CLOUD_PROGRESS_DIR, file_name).await
                {
                    Ok(contents) => {
                        if let Err(error) = write_binary_file(&local_path, &contents) {
                            log_warn(
                                "webdav-sync",
                                &format!(
                                    "reconcile-write-local-failed file={} error={}",
                                    file_name, error
                                ),
                            );
                            continue;
                        }
                        cache.insert(file_name.clone(), meta_from_remote(meta, &contents));
                        result.pulled_files.push(file_name.clone());
                    }
                    Err(error) => {
                        log_warn(
                            "webdav-sync",
                            &format!(
                                "reconcile-download-failed file={} error={}",
                                file_name, error.message
                            ),
                        );
                    }
                }
            }
            // 两边都存在 → 元数据判变化
            (true, Some(meta)) => {
                let contents = match read_binary_file(&local_path) {
                    Ok(contents) => contents,
                    Err(error) => {
                        log_warn(
                            "webdav-sync",
                            &format!(
                                "reconcile-read-local-failed file={} error={}",
                                file_name, error
                            ),
                        );
                        continue;
                    }
                };
                let local_time = read_dur_chapter_time(&contents);

                if let Some(cached) = cache.get(file_name) {
                    if cloud_meta_unchanged(cached, meta) {
                        if local_is_newer_than_cached(local_time, cached.dur_chapter_time) {
                            if let Err(error) = upload_remote_file(
                                &client,
                                &settings,
                                CLOUD_PROGRESS_DIR,
                                file_name,
                                contents,
                            )
                            .await
                            {
                                log_warn(
                                    "webdav-sync",
                                    &format!(
                                        "reconcile-upload-failed file={} error={}",
                                        file_name, error.message
                                    ),
                                );
                                continue;
                            }
                            cache.insert(
                                file_name.clone(),
                                CloudProgressMeta {
                                    etag: None,
                                    last_modified: None,
                                    dur_chapter_time: local_time,
                                },
                            );
                            result.pushed_files.push(file_name.clone());
                        } else {
                            result.unchanged_count += 1;
                        }
                        continue;
                    }
                }

                // 云端已变化或缺少可判定元数据 → 下载云端后按 durChapterTime 比较
                match download_remote_file(&client, &settings, CLOUD_PROGRESS_DIR, file_name).await
                {
                    Ok(cloud_contents) => {
                        if contents == cloud_contents {
                            result.unchanged_count += 1;
                            cache.insert(file_name.clone(), meta_from_remote(meta, &cloud_contents));
                        } else if should_upload_local_config(&contents, &cloud_contents) {
                            if let Err(error) = upload_remote_file(
                                &client,
                                &settings,
                                CLOUD_PROGRESS_DIR,
                                file_name,
                                contents,
                            )
                            .await
                            {
                                log_warn(
                                    "webdav-sync",
                                    &format!(
                                        "reconcile-upload-failed file={} error={}",
                                        file_name, error.message
                                    ),
                                );
                                continue;
                            }
                            cache.insert(
                                file_name.clone(),
                                CloudProgressMeta {
                                    etag: None,
                                    last_modified: None,
                                    dur_chapter_time: local_time,
                                },
                            );
                            result.pushed_files.push(file_name.clone());
                        } else {
                            if let Err(error) = write_binary_file(&local_path, &cloud_contents) {
                                log_warn(
                                    "webdav-sync",
                                    &format!(
                                        "reconcile-write-local-failed file={} error={}",
                                        file_name, error
                                    ),
                                );
                                continue;
                            }
                            cache.insert(file_name.clone(), meta_from_remote(meta, &cloud_contents));
                            result.pulled_files.push(file_name.clone());
                        }
                    }
                    Err(error) => {
                        log_warn(
                            "webdav-sync",
                            &format!(
                                "reconcile-download-failed file={} error={}",
                                file_name, error.message
                            ),
                        );
                    }
                }
            }
            (false, None) => {}
        }
    }

    save_progress_meta_cache(&cached_path, &cache);

    log_info(
        "webdav-sync",
        &format!(
            "reconcile-progress-configs-done pulled={} pushed={} unchanged={}",
            result.pulled_files.len(),
            result.pushed_files.len(),
            result.unchanged_count
        ),
    );

    Ok(result)
}
