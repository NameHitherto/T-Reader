use serde::{Deserialize, Serialize};

fn default_theme_mode() -> String {
    "light".to_string()
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
}
