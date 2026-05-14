use serde::{Deserialize, Serialize};
use std::collections::HashMap;

fn default_theme_mode() -> String {
    "light".to_string()
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
    #[serde(default, rename = "modelId")]
    pub model_id: String,
    #[serde(default, rename = "apiKey")]
    pub api_key: String,
}

#[derive(Serialize, Deserialize)]
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
    #[serde(default, rename = "isAiEnabled")]
    pub is_ai_enabled: String,
    #[serde(default, rename = "modelName")]
    pub model_name: String,
    #[serde(default, rename = "modelUrl")]
    pub model_url: String,
    #[serde(default, rename = "modelApiKey")]
    pub model_api_key: String,
    #[serde(default = "default_theme_mode", rename = "themeMode")]
    pub theme_mode: String,
    #[serde(default, rename = "modelProviders")]
    pub model_providers: Option<HashMap<String, ModelProviderConfig>>,
}
