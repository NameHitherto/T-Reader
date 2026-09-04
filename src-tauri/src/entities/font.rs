use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct FontNameEntry {
    pub family: String,
    pub display_family: String,
    pub subfamily: Option<String>,
    pub full_name: Option<String>,
    pub postscript_name: Option<String>,
    pub weight: Option<u16>,
    pub path: Option<String>,
    pub face_index: u32,
    pub family_aliases: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct LocalFontEntry {
    pub filename: String,
    #[serde(flatten)]
    pub font: FontNameEntry,
}

#[derive(Debug, Serialize)]
pub struct LocalFontWarning {
    pub filename: String,
    pub reason: String,
}

#[derive(Debug, Default, Serialize)]
pub struct LocalFontsResult {
    pub fonts: Vec<LocalFontEntry>,
    pub warnings: Vec<LocalFontWarning>,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum FontExtractionStatus {
    Extracted,
    Existing,
    Skipped,
    Failed,
}

#[derive(Debug, Serialize)]
pub struct ExtractedFontResult {
    pub source_path: String,
    pub filename: Option<String>,
    pub fonts: Vec<LocalFontEntry>,
    pub status: FontExtractionStatus,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DeleteLocalFontResult {
    pub deleted: bool,
}
