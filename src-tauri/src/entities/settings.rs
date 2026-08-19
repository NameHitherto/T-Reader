use serde::{Deserialize, Serialize};
use std::collections::HashMap;

fn default_theme_mode() -> String {
    "light".to_string()
}

fn default_update_channel() -> String {
    "stable".to_string()
}

fn default_webdav_timeout_seconds() -> i64 {
    30
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModelProviderConfig {
    #[serde(default, rename = "purpose")]
    pub purpose: String,
    #[serde(default, rename = "providerType")]
    pub provider_type: String,
    #[serde(default, rename = "baseUrl")]
    pub base_url: String,
    #[serde(default, rename = "endpoint")]
    pub endpoint: String,
    #[serde(default, rename = "fullUrl")]
    pub full_url: bool,
    #[serde(default, rename = "modelId")]
    pub model_id: String,
    #[serde(default, rename = "apiKey")]
    pub api_key: String,
    #[serde(default, rename = "batchSize")]
    pub batch_size: Option<i64>,
    #[serde(default, rename = "vectorDimension")]
    pub vector_dimension: Option<i64>,
    #[serde(default, rename = "contextWindowSize")]
    pub context_window_size: Option<i64>,
}

impl ModelProviderConfig {
    pub fn request_url(&self, endpoint: &str) -> String {
        if self.full_url {
            self.base_url.trim().to_string()
        } else {
            format!("{}{}", self.base_url.trim_end_matches('/'), endpoint)
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Settings {
    #[serde(default, rename = "webdavUrlRoot")]
    pub webdav_url_root: String,
    #[serde(default, rename = "webdavUrlFolder")]
    pub webdav_url_folder: String,
    #[serde(default, rename = "webdavUrl")]
    pub webdav_url: String,
    #[serde(default, rename = "webdavUser")]
    pub webdav_user: String,
    #[serde(default, rename = "webdavPass")]
    pub webdav_pass: String,
    #[serde(default = "default_webdav_timeout_seconds", rename = "webdavTimeoutSeconds")]
    pub webdav_timeout_seconds: i64,
    #[serde(default = "default_theme_mode", rename = "themeMode")]
    pub theme_mode: String,
    #[serde(default = "default_update_channel", rename = "updateChannel")]
    pub update_channel: String,
    #[serde(default, rename = "proxyEnabled")]
    pub proxy_enabled: bool,
    #[serde(default, rename = "modelProviders")]
    pub model_providers: HashMap<String, ModelProviderConfig>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SaveAppSettingsRequest {
    pub webdav_url_root: Option<String>,
    pub webdav_url_folder: Option<String>,
    pub webdav_url: Option<String>,
    pub webdav_user: Option<String>,
    pub webdav_pass: Option<String>,
    pub webdav_timeout_seconds: Option<i64>,
    pub theme_mode: Option<String>,
    pub update_channel: Option<String>,
    pub proxy_enabled: Option<bool>,
    pub model_providers: Option<HashMap<String, ModelProviderConfig>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ReaderStyleSettings {
    pub font_size: f64,
    pub font_weight: f64,
    pub line_spacing: f64,
    pub paragraph_spacing: f64,
    pub letter_spacing: f64,
    pub box_padding_top: f64,
    pub box_padding_bottom: f64,
    pub box_padding_horizontal: f64,
    pub column_count: f64,
    pub indent: f64,
    pub font: String,
    pub color: String,
    pub font_color: String,
    pub background_presets: serde_json::Value,
    pub flow: String,
    pub enabled_system_fonts: serde_json::Value,
    pub load_epub_built_in_stylesheet: bool,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SaveReaderStyleSettingsRequest {
    pub font_size: Option<f64>,
    pub font_weight: Option<f64>,
    pub line_spacing: Option<f64>,
    pub paragraph_spacing: Option<f64>,
    pub letter_spacing: Option<f64>,
    pub box_padding_top: Option<f64>,
    pub box_padding_bottom: Option<f64>,
    pub box_padding_horizontal: Option<f64>,
    pub column_count: Option<f64>,
    pub indent: Option<f64>,
    pub font: Option<String>,
    pub color: Option<String>,
    pub font_color: Option<String>,
    pub background_presets: Option<serde_json::Value>,
    pub flow: Option<String>,
    pub enabled_system_fonts: Option<serde_json::Value>,
    pub load_epub_built_in_stylesheet: Option<bool>,
}
