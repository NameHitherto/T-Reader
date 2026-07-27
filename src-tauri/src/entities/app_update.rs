use serde::Serialize;
use std::{collections::HashMap, sync::Mutex};
use tauri_plugin_updater::Update;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyPrepareResult {
    pub enabled: bool,
    pub source: String,
    pub proxy_mode: String,
    pub proxy_url: Option<String>,
}

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
    pub update_channel: String,
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

pub struct PendingUpdate {
    pub update: Update,
    pub source: AppUpdateSource,
    pub created_at: u64,
}

#[derive(Default)]
pub struct AppUpdateState {
    pub pending_updates: Mutex<HashMap<String, PendingUpdate>>,
}
