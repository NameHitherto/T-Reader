use serde::{Deserialize, Serialize};

// 书籍信息
#[derive(Serialize, Deserialize)]
pub struct Book {
    pub id: String,
    pub cover: String,
    pub title: String,
    pub author: String,
    pub language: String,
    pub size: String,
    #[serde(rename = "lastRead")]
    pub last_read: String,
    pub added: String,
    pub path: String,
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