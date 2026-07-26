use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct GalleryImageDto {
    pub id: String,
    pub book_key: Option<String>,
    pub book_title: String,
    pub prompt: String,
    pub provider_type: String,
    pub model_id: String,
    pub image_path: String,
    pub reference_paths: String,
    pub image_size: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateGalleryImageRequest {
    pub prompt: String,
    #[serde(default)]
    pub book_key: Option<String>,
    #[serde(default)]
    pub book_title: Option<String>,
    #[serde(default)]
    pub reference_paths: Vec<String>,
    #[serde(default)]
    pub size: Option<String>,
}
