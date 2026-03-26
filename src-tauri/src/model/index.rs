use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct Book {
    pub name: String,
    pub author: String,
    #[serde(default, rename = "durChapterIndex")]
    pub dur_chapter_index: Option<i64>,
    #[serde(default, rename = "durChapterPos")]
    pub dur_chapter_pos: Option<i64>,
    #[serde(default, rename = "durChapterTitle")]
    pub dur_chapter_title: Option<String>,
    #[serde(default, rename = "durChapterTime")]
    pub dur_chapter_time: Option<i64>,
}

#[derive(Serialize)]
pub struct StoredBook {
    #[serde(rename = "filename")]
    pub filename: String,
    #[serde(rename = "book")]
    pub book: Book,
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
