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
    pub created_at: String,
    pub updated_at: String,
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
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedBookFile {
    pub file_name: String,
    pub format: String,
}
