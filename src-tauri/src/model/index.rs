use serde::{Deserialize, Serialize};

fn default_book_format() -> String {
    "epub".to_string()
}

fn default_location_format() -> String {
    "cfi".to_string()
}

fn default_schema_version() -> u32 {
    1
}

fn default_empty_string() -> String {
    String::new()
}

// 书籍信息
#[derive(Serialize, Deserialize)]
pub struct Book {
    #[serde(default = "default_schema_version", rename = "schemaVersion")]
    pub schema_version: u32,
    pub id: String,
    #[serde(default = "default_book_format")]
    pub format: String,
    #[serde(default = "default_location_format", rename = "locationFormat")]
    pub location_format: String,
    pub title: String,
    pub author: String,
    pub language: String,
    pub size: String,
    #[serde(default)]
    pub progress: Option<f64>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default, rename = "deviceId")]
    pub device_id: Option<String>,
    #[serde(default, rename = "updatedAt")]
    pub updated_at: Option<String>,
    #[serde(rename = "lastRead")]
    pub last_read: String,
    pub added: String,
    pub path: String,
    #[serde(default = "default_empty_string")]
    pub location: String,
}

// 设置中心配置
#[derive(Serialize, Deserialize)]
pub struct Settings {
    #[serde(rename = "webdavUrlRoot")]
    pub webdav_url_root: String,
    #[serde(rename = "webdavUrlFolder")]
    pub webdav_url_folder: String,
    #[serde(rename = "webdavUrl")]
    pub webdav_url: String,
    #[serde(rename = "webdavUser")]
    pub webdav_user: String,
    #[serde(rename = "webdavPass")]
    pub webdav_pass: String,
    #[serde(rename = "isAiEnabled")]
    pub is_ai_enabled: String,
    #[serde(rename = "modelName")]
    pub model_name: String,
    #[serde(rename = "modelUrl")]
    pub model_url: String,
    #[serde(rename = "modelApiKey")]
    pub model_api_key: String,
}

// 系统字体映射
#[derive(Serialize)]
pub struct FontNameEntry {
    pub family: String,
    pub postscript_name: Option<String>,
    pub style: Option<String>,
    pub weight: Option<u16>,
    pub path: Option<String>,
}
