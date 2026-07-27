use std::{
    sync::atomic::{AtomicU64, Ordering},
    time::{Duration, Instant},
};

use semver::Version;
use serde::Deserialize;
use tauri::{ipc::Channel, AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::{
    entities::{
        AppUpdateAttempt, AppUpdateCheckResult, AppUpdateProgressEvent, AppUpdateProxyInfo,
        AppUpdateSource, AppUpdateState, PendingUpdate, ProxyPrepareResult,
    },
    repository::system::proxy_repository::detect_updater_proxy,
    utils::time::now_millis,
};

const OFFICIAL_UPDATE_ENDPOINT: &str =
    "https://github.com/NameHitherto/T-Reader/releases/latest/download/latest.json";
const GITHUB_RELEASES_API_ENDPOINT: &str =
    "https://api.github.com/repos/NameHitherto/T-Reader/releases?per_page=100";
const MIRROR_PROXY_BASE: &str = "https://v6.gh-proxy.org/";
const CHECK_TIMEOUT_SECS: u64 = 12;
const PENDING_UPDATE_EXPIRE_MS: u64 = 60 * 60 * 1000;
static UPDATE_TOKEN_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Deserialize)]
struct GithubReleaseAsset {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, Deserialize)]
struct GithubRelease {
    draft: bool,
    tag_name: String,
    assets: Vec<GithubReleaseAsset>,
}

pub fn prepare_updater_proxy() -> Result<ProxyPrepareResult, String> {
    Ok(detect_updater_proxy())
}

fn normalize_update_channel(value: &str) -> &str {
    if value == "preview" {
        "preview"
    } else {
        "stable"
    }
}

fn build_update_sources(official_endpoint: &str) -> Vec<AppUpdateSource> {
    let mirror_endpoint = build_mirror_endpoint(official_endpoint);
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
            endpoint: Some(official_endpoint.to_string()),
            enabled: true,
        },
    ]
}

fn select_preview_endpoint(releases: Vec<GithubRelease>) -> Result<String, String> {
    releases
        .into_iter()
        .filter(|release| !release.draft)
        .filter_map(|release| {
            let version = Version::parse(release.tag_name.trim_start_matches('v')).ok()?;
            let endpoint = release
                .assets
                .into_iter()
                .find(|asset| asset.name == "latest.json")?
                .browser_download_url;
            Some((version, endpoint))
        })
        .max_by(|(left, _), (right, _)| left.cmp(right))
        .map(|(_, endpoint)| endpoint)
        .ok_or_else(|| "GitHub Releases 中没有可用的更新清单".to_string())
}

async fn discover_preview_endpoint(proxy: &AppUpdateProxyInfo) -> Result<String, String> {
    let mut builder = reqwest::Client::builder().timeout(Duration::from_secs(CHECK_TIMEOUT_SECS));
    if let Some(proxy_url) = proxy.proxy_url.as_ref() {
        let request_proxy = reqwest::Proxy::all(proxy_url).map_err(|error| error.to_string())?;
        builder = builder.proxy(request_proxy);
    } else {
        builder = builder.no_proxy();
    }

    let response = builder
        .build()
        .map_err(|error| error.to_string())?
        .get(GITHUB_RELEASES_API_ENDPOINT)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .header(reqwest::header::USER_AGENT, "T-Reader-Updater")
        .send()
        .await
        .map_err(|error| format!("访问 GitHub Releases API 失败: {error}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("GitHub Releases API 返回 HTTP {status}"));
    }

    let body = response
        .text()
        .await
        .map_err(|error| format!("读取 GitHub Releases API 响应失败: {error}"))?;
    let releases = serde_json::from_str::<Vec<GithubRelease>>(&body)
        .map_err(|error| format!("解析 GitHub Releases API 响应失败: {error}"))?;

    select_preview_endpoint(releases)
}

#[cfg(test)]
mod tests {
    use super::{
        normalize_update_channel, select_preview_endpoint, GithubRelease, GithubReleaseAsset,
    };

    fn release(tag_name: &str, draft: bool, manifest_url: Option<&str>) -> GithubRelease {
        GithubRelease {
            draft,
            tag_name: tag_name.to_string(),
            assets: manifest_url
                .map(|url| {
                    vec![GithubReleaseAsset {
                        name: "latest.json".to_string(),
                        browser_download_url: url.to_string(),
                    }]
                })
                .unwrap_or_default(),
        }
    }

    #[test]
    fn preview_channel_selects_highest_semver_across_release_types() {
        let endpoint = select_preview_endpoint(vec![
            release("v1.8.0", false, Some("https://example.com/stable.json")),
            release(
                "v1.9.0-beta.2",
                false,
                Some("https://example.com/preview.json"),
            ),
        ])
        .expect("a valid release should be selected");

        assert_eq!(endpoint, "https://example.com/preview.json");
    }

    #[test]
    fn preview_channel_can_select_newer_stable_release() {
        let endpoint = select_preview_endpoint(vec![
            release(
                "v2.0.0-rc.1",
                false,
                Some("https://example.com/preview.json"),
            ),
            release("v2.0.0", false, Some("https://example.com/stable.json")),
        ])
        .expect("a valid release should be selected");

        assert_eq!(endpoint, "https://example.com/stable.json");
    }

    #[test]
    fn preview_channel_ignores_unusable_releases() {
        let endpoint = select_preview_endpoint(vec![
            release("v9.0.0", true, Some("https://example.com/draft.json")),
            release(
                "not-semver",
                false,
                Some("https://example.com/invalid.json"),
            ),
            release("v8.0.0", false, None),
            release("v1.0.0", false, Some("https://example.com/valid.json")),
        ])
        .expect("the usable release should be selected");

        assert_eq!(endpoint, "https://example.com/valid.json");
    }

    #[test]
    fn update_channel_defaults_to_stable() {
        assert_eq!(normalize_update_channel("preview"), "preview");
        assert_eq!(normalize_update_channel("stable"), "stable");
        assert_eq!(normalize_update_channel("unknown"), "stable");
    }
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

fn purge_expired_pending_updates(map: &mut std::collections::HashMap<String, PendingUpdate>) {
    let now = now_millis();
    map.retain(|_, pending| now.saturating_sub(pending.created_at) <= PENDING_UPDATE_EXPIRE_MS);
}

fn build_failed_check_result(
    update_channel: String,
    current_version: String,
    source: AppUpdateSource,
    sources: Vec<AppUpdateSource>,
    proxy: AppUpdateProxyInfo,
    attempts: Vec<AppUpdateAttempt>,
    error: String,
) -> AppUpdateCheckResult {
    AppUpdateCheckResult {
        has_update: false,
        update_channel,
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

pub async fn check_app_update(
    update_channel: String,
    app: AppHandle,
    state: State<'_, AppUpdateState>,
) -> Result<AppUpdateCheckResult, String> {
    let update_channel = normalize_update_channel(&update_channel).to_string();
    let current_version = app.package_info().version.to_string();
    let proxy = to_proxy_info();
    let mut attempts: Vec<AppUpdateAttempt> = Vec::new();
    let official_endpoint = if update_channel == "preview" {
        let started_at = Instant::now();
        match discover_preview_endpoint(&proxy).await {
            Ok(endpoint) => {
                attempts.push(AppUpdateAttempt {
                    stage: "release-discovery".to_string(),
                    source_id: "github-releases-api".to_string(),
                    endpoint: GITHUB_RELEASES_API_ENDPOINT.to_string(),
                    proxy_mode: proxy.proxy_mode.clone(),
                    duration_ms: started_at.elapsed().as_millis() as u64,
                    success: true,
                    error_summary: None,
                });
                endpoint
            }
            Err(error) => {
                attempts.push(AppUpdateAttempt {
                    stage: "release-discovery".to_string(),
                    source_id: "github-releases-api".to_string(),
                    endpoint: GITHUB_RELEASES_API_ENDPOINT.to_string(),
                    proxy_mode: proxy.proxy_mode.clone(),
                    duration_ms: started_at.elapsed().as_millis() as u64,
                    success: false,
                    error_summary: Some(error.clone()),
                });
                let sources = build_update_sources(OFFICIAL_UPDATE_ENDPOINT);
                let selected_source = sources
                    .first()
                    .cloned()
                    .ok_or_else(|| "未找到更新源定义".to_string())?;
                return Ok(build_failed_check_result(
                    update_channel,
                    current_version,
                    selected_source,
                    sources,
                    proxy,
                    attempts,
                    error,
                ));
            }
        }
    } else {
        OFFICIAL_UPDATE_ENDPOINT.to_string()
    };
    let sources = build_update_sources(&official_endpoint);
    let selected_source = sources
        .iter()
        .find(|source| source.enabled)
        .cloned()
        .or_else(|| sources.first().cloned())
        .ok_or_else(|| "未找到更新源定义".to_string())?;
    let mut no_update_source: Option<AppUpdateSource> = None;

    let enabled_sources: Vec<AppUpdateSource> = sources
        .iter()
        .filter(|source| source.enabled)
        .cloned()
        .collect();
    if enabled_sources.is_empty() {
        return Ok(build_failed_check_result(
            update_channel,
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
                    update_channel,
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
            update_channel,
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
        update_channel,
        current_version,
        selected_source,
        sources,
        proxy,
        attempts,
        failure_summary,
    ))
}

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

    Ok(())
}
