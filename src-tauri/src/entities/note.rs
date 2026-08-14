use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct BookMarkDto {
    pub id: String,
    pub content: String,
    pub book_name: String,
    pub book_title: String,
    pub book_cfi: String,
    pub create_time: String,
    pub comments: Option<String>,
    pub underline_color: Option<String>,
    pub underline_type: Option<String>,
    pub underline_width: Option<f64>,
}
