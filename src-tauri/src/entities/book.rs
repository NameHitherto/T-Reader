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
