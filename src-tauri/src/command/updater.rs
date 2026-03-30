use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use tauri::{ipc::Channel, AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::command::proxy::detect_updater_proxy;

const OFFICIAL_UPDATE_ENDPOINT: &str =
    "https://github.com/NameHitherto/T-Reader/releases/latest/download/latest.json";
const MIRROR_PROXY_BASE: &str = "https://v6.gh-proxy.org/";
const CHECK_TIMEOUT_SECS: u64 = 12;
const PENDING_UPDATE_EXPIRE_MS: u64 = 60 * 60 * 1000;
static UPDATE_TOKEN_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateSource {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub endpoint: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateProxyInfo {
    pub source: String,
    pub proxy_mode: String,
    pub proxy_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateAttempt {
    pub stage: String,
    pub source_id: String,
    pub endpoint: String,
    pub proxy_mode: String,
    pub duration_ms: u64,
    pub success: bool,
    pub error_summary: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateCheckResult {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub release_notes: Option<String>,
    pub published_at: Option<String>,
    pub source: AppUpdateSource,
    pub sources: Vec<AppUpdateSource>,
    pub proxy: AppUpdateProxyInfo,
    pub attempts: Vec<AppUpdateAttempt>,
    pub checked_at: u64,
    pub update_token: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateProgressEvent {
    pub stage: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub percent: Option<f64>,
    pub speed_bytes_per_sec: Option<u64>,
    pub message: String,
    pub source_label: String,
    pub error_summary: Option<String>,
    pub event_at: u64,
}

struct PendingUpdate {
    update: Update,
    source: AppUpdateSource,
    created_at: u64,
}

#[derive(Default)]
pub struct AppUpdateState {
    pending_updates: Mutex<HashMap<String, PendingUpdate>>,
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn build_update_sources() -> Vec<AppUpdateSource> {
    let mirror_endpoint = build_mirror_endpoint(OFFICIAL_UPDATE_ENDPOINT);
    vec![
        AppUpdateSource {
            id: "mirror-v6-gh-proxy".to_string(),
            label: "镜像源（v6.gh-proxy.org）".to_string(),
            kind: "mirror".to_string(),
            endpoint: Some(mirror_endpoint),
            enabled: true,
        },
        AppUpdateSource {
            id: "official".to_string(),
            label: "官方源（GitHub Releases）".to_string(),
            kind: "official".to_string(),
            endpoint: Some(OFFICIAL_UPDATE_ENDPOINT.to_string()),
            enabled: true,
        },
    ]
}

fn build_mirror_endpoint(target: &str) -> String {
    let base = MIRROR_PROXY_BASE.trim_end_matches('/');
    if target.starts_with(base) {
        return target.to_string();
    }
    format!("{base}/{}", target.trim_start_matches('/'))
}

fn rewrite_download_url_for_source(
    source: &AppUpdateSource,
    update: &mut Update,
) -> Result<(), String> {
    if source.kind != "mirror" {
        return Ok(());
    }

    let raw_url = update.download_url.as_str().to_string();
    let mirrored_url = build_mirror_endpoint(&raw_url);
    let parsed =
        reqwest::Url::parse(&mirrored_url).map_err(|error| format!("镜像下载地址无效: {error}"))?;
    update.download_url = parsed;
    Ok(())
}

fn to_proxy_info() -> AppUpdateProxyInfo {
    let proxy = detect_updater_proxy();
    AppUpdateProxyInfo {
        source: proxy.source,
        proxy_mode: proxy.proxy_mode,
        proxy_url: proxy.proxy_url,
    }
}

fn next_update_token() -> String {
    let counter = UPDATE_TOKEN_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("update-{}-{}", now_millis(), counter)
}

fn purge_expired_pending_updates(map: &mut HashMap<String, PendingUpdate>) {
    let now = now_millis();
    map.retain(|_, pending| now.saturating_sub(pending.created_at) <= PENDING_UPDATE_EXPIRE_MS);
}

fn build_failed_check_result(
    current_version: String,
    source: AppUpdateSource,
    sources: Vec<AppUpdateSource>,
    proxy: AppUpdateProxyInfo,
    attempts: Vec<AppUpdateAttempt>,
    error: String,
) -> AppUpdateCheckResult {
    AppUpdateCheckResult {
        has_update: false,
        current_version,
        latest_version: None,
        release_notes: None,
        published_at: None,
        source,
        sources,
        proxy,
        attempts,
        checked_at: now_millis(),
        update_token: None,
        error: Some(error),
    }
}

async fn check_source_for_update(
    app: &AppHandle,
    source: &AppUpdateSource,
    proxy: &AppUpdateProxyInfo,
) -> Result<Option<Update>, String> {
    let endpoint = source
        .endpoint
        .as_ref()
        .ok_or_else(|| format!("更新源 '{}' 的 endpoint 未配置", source.id))?;
    let endpoint_url = reqwest::Url::parse(endpoint).map_err(|error| error.to_string())?;

    let mut builder = app
        .updater_builder()
        .endpoints(vec![endpoint_url])
        .map_err(|error| error.to_string())?
        .timeout(Duration::from_secs(CHECK_TIMEOUT_SECS));

    if let Some(proxy_url) = proxy.proxy_url.as_ref() {
        let parsed_proxy = reqwest::Url::parse(proxy_url).map_err(|error| error.to_string())?;
        builder = builder.proxy(parsed_proxy);
    } else {
        builder = builder.no_proxy();
    }

    let updater = builder.build().map_err(|error| error.to_string())?;
    updater.check().await.map_err(|error| error.to_string())
}

fn send_progress_event(channel: &Channel<AppUpdateProgressEvent>, event: AppUpdateProgressEvent) {
    let _ = channel.send(event);
}

fn build_progress_event(
    stage: &str,
    source_label: &str,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    speed_bytes_per_sec: Option<u64>,
    message: &str,
    error_summary: Option<String>,
) -> AppUpdateProgressEvent {
    let percent = total_bytes
        .filter(|total| *total > 0)
        .map(|total| ((downloaded_bytes as f64 / total as f64) * 100.0).min(100.0));

    AppUpdateProgressEvent {
        stage: stage.to_string(),
        downloaded_bytes,
        total_bytes,
        percent,
        speed_bytes_per_sec,
        message: message.to_string(),
        source_label: source_label.to_string(),
        error_summary,
        event_at: now_millis(),
    }
}

#[tauri::command]
pub async fn check_app_update(
    app: AppHandle,
    state: State<'_, AppUpdateState>,
) -> Result<AppUpdateCheckResult, String> {
    let current_version = app.package_info().version.to_string();
    let sources = build_update_sources();
    let selected_source = sources
        .iter()
        .find(|source| source.enabled)
        .cloned()
        .or_else(|| sources.first().cloned())
        .ok_or_else(|| "未找到更新源定义".to_string())?;
    let proxy = to_proxy_info();
    let mut attempts: Vec<AppUpdateAttempt> = Vec::new();
    let mut no_update_source: Option<AppUpdateSource> = None;

    let enabled_sources: Vec<AppUpdateSource> = sources
        .iter()
        .filter(|source| source.enabled)
        .cloned()
        .collect();
    if enabled_sources.is_empty() {
        return Ok(build_failed_check_result(
            current_version,
            selected_source,
            sources,
            proxy,
            attempts,
            "当前没有可用的更新源".to_string(),
        ));
    }

    for source in enabled_sources {
        let endpoint = source.endpoint.clone().unwrap_or_default();
        let started_at = Instant::now();
        match check_source_for_update(&app, &source, &proxy).await {
            Ok(Some(mut update)) => {
                if let Err(error) = rewrite_download_url_for_source(&source, &mut update) {
                    attempts.push(AppUpdateAttempt {
                        stage: "metadata-check".to_string(),
                        source_id: source.id.clone(),
                        endpoint,
                        proxy_mode: proxy.proxy_mode.clone(),
                        duration_ms: started_at.elapsed().as_millis() as u64,
                        success: false,
                        error_summary: Some(error),
                    });
                    continue;
                }

                attempts.push(AppUpdateAttempt {
                    stage: "metadata-check".to_string(),
                    source_id: source.id.clone(),
                    endpoint,
                    proxy_mode: proxy.proxy_mode.clone(),
                    duration_ms: started_at.elapsed().as_millis() as u64,
                    success: true,
                    error_summary: None,
                });

                let latest_version = update.version.clone();
                let release_notes = update.body.clone();
                let published_at = update.date.map(|date| date.to_string());
                let update_token = next_update_token();

                {
                    let mut pending_updates = state
                        .pending_updates
                        .lock()
                        .map_err(|_| "failed to lock update state".to_string())?;
                    purge_expired_pending_updates(&mut pending_updates);
                    pending_updates.insert(
                        update_token.clone(),
                        PendingUpdate {
                            update,
                            source: source.clone(),
                            created_at: now_millis(),
                        },
                    );
                }

                return Ok(AppUpdateCheckResult {
                    has_update: true,
                    current_version,
                    latest_version: Some(latest_version),
                    release_notes,
                    published_at,
                    source,
                    sources,
                    proxy,
                    attempts,
                    checked_at: now_millis(),
                    update_token: Some(update_token),
                    error: None,
                });
            }
            Ok(None) => {
                attempts.push(AppUpdateAttempt {
                    stage: "metadata-check".to_string(),
                    source_id: source.id.clone(),
                    endpoint,
                    proxy_mode: proxy.proxy_mode.clone(),
                    duration_ms: started_at.elapsed().as_millis() as u64,
                    success: true,
                    error_summary: None,
                });

                if no_update_source.is_none() {
                    no_update_source = Some(source.clone());
                }
                continue;
            }
            Err(error) => {
                attempts.push(AppUpdateAttempt {
                    stage: "metadata-check".to_string(),
                    source_id: source.id.clone(),
                    endpoint,
                    proxy_mode: proxy.proxy_mode.clone(),
                    duration_ms: started_at.elapsed().as_millis() as u64,
                    success: false,
                    error_summary: Some(error),
                });
            }
        }
    }

    if let Some(source) = no_update_source {
        return Ok(AppUpdateCheckResult {
            has_update: false,
            current_version: current_version.clone(),
            latest_version: Some(current_version),
            release_notes: None,
            published_at: None,
            source,
            sources,
            proxy,
            attempts,
            checked_at: now_millis(),
            update_token: None,
            error: None,
        });
    }

    let failure_summary = attempts
        .iter()
        .rev()
        .find_map(|attempt| attempt.error_summary.clone())
        .unwrap_or_else(|| "更新检查失败".to_string());

    Ok(build_failed_check_result(
        current_version,
        selected_source,
        sources,
        proxy,
        attempts,
        failure_summary,
    ))
}

#[tauri::command]
pub async fn install_app_update(
    update_token: String,
    on_event: Channel<AppUpdateProgressEvent>,
    state: State<'_, AppUpdateState>,
) -> Result<(), String> {
    let pending_update = {
        let mut pending_updates = state
            .pending_updates
            .lock()
            .map_err(|_| "failed to lock update state".to_string())?;
        purge_expired_pending_updates(&mut pending_updates);
        pending_updates.remove(&update_token)
    }
    .ok_or_else(|| "更新令牌无效或已过期，请重新检查更新".to_string())?;

    let source_label = pending_update.source.label.clone();
    let update = pending_update.update;

    send_progress_event(
        &on_event,
        build_progress_event(
            "preparing",
            &source_label,
            0,
            None,
            None,
            "正在准备更新包",
            None,
        ),
    );

    let started_at = Instant::now();
    let mut downloaded_bytes = 0_u64;
    let mut total_bytes: Option<u64> = None;
    let bytes = match update
        .download(
            |chunk_length, content_length| {
                downloaded_bytes = downloaded_bytes.saturating_add(chunk_length as u64);
                if let Some(length) = content_length {
                    total_bytes = Some(length);
                }

                let elapsed_secs = started_at.elapsed().as_secs_f64().max(0.001);
                let speed_bytes_per_sec = Some((downloaded_bytes as f64 / elapsed_secs) as u64);
                send_progress_event(
                    &on_event,
                    build_progress_event(
                        "downloading",
                        &source_label,
                        downloaded_bytes,
                        total_bytes,
                        speed_bytes_per_sec,
                        "正在下载更新包",
                        None,
                    ),
                );
            },
            || {},
        )
        .await
    {
        Ok(bytes) => bytes,
        Err(error) => {
            let error_summary = format!("下载失败: {error}");
            send_progress_event(
                &on_event,
                build_progress_event(
                    "failed",
                    &source_label,
                    downloaded_bytes,
                    total_bytes,
                    None,
                    "更新下载失败",
                    Some(error_summary.clone()),
                ),
            );
            return Err(error_summary);
        }
    };

    send_progress_event(
        &on_event,
        build_progress_event(
            "installing",
            &source_label,
            downloaded_bytes,
            total_bytes,
            None,
            "下载完成，正在准备安装",
            None,
        ),
    );

    #[cfg(target_os = "windows")]
    send_progress_event(
        &on_event,
        build_progress_event(
            "handoff",
            &source_label,
            downloaded_bytes,
            total_bytes,
            None,
            "安装器已启动，应用即将退出",
            None,
        ),
    );

    if let Err(error) = update.install(&bytes) {
        let error_summary = format!("安装失败: {error}");
        send_progress_event(
            &on_event,
            build_progress_event(
                "failed",
                &source_label,
                downloaded_bytes,
                total_bytes,
                None,
                "更新安装失败",
                Some(error_summary.clone()),
            ),
        );
        return Err(error_summary);
    }

    #[cfg(not(target_os = "windows"))]
    send_progress_event(
        &on_event,
        build_progress_event(
            "handoff",
            &source_label,
            downloaded_bytes,
            total_bytes,
            None,
            "更新已安装，请重启应用",
            None,
        ),
    );

    Ok(())
}
