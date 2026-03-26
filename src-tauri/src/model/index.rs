use serde::{Deserialize, Serialize};

fn default_empty_string() -> String {
    String::new()
}

#[derive(Serialize, Deserialize)]
pub struct Book {
    pub id: String,
    pub title: String,
    pub author: String,
    #[serde(default = "default_empty_string")]
    pub location: String,
    #[serde(default, rename = "updatedAt")]
    pub updated_at: Option<String>,
    #[serde(default, rename = "bookMarks")]
    pub book_marks: Option<Vec<serde_json::Value>>,
}

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

#[derive(Serialize)]
pub struct FontNameEntry {
    pub family: String,
    pub postscript_name: Option<String>,
    pub style: Option<String>,
    pub weight: Option<u16>,
    pub path: Option<String>,
}
