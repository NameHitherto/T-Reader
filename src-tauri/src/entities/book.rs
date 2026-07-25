use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct BookRecord {
    pub id: String,
    pub title: String,
    pub author: String,
    pub book_key: String,
    pub file_name: String,
    pub format: String,
    pub cache_name: String,
    pub has_cover: bool,
    pub cover_name: Option<String>,
    pub progress: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBookMetadataRequest {
    pub book_key: String,
    pub title: String,
    pub author: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBookMetadataResult {
    pub old_book_key: String,
    pub book: BookRecord,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertBookRequest {
    pub book_key: Option<String>,
    pub title: String,
    pub author: String,
    pub file_name: String,
    pub format: Option<String>,
    pub cache_name: Option<String>,
    pub has_cover: Option<bool>,
    pub cover_name: Option<String>,
    pub progress: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedBookFile {
    pub file_name: String,
    pub format: String,
}

/// 书籍导入结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportBookResult {
    pub book_key: String,
    pub title: String,
    pub author: String,
    pub file_name: String,
    pub used_cloud_config: bool,
    pub created_record: BookRecord,
}
