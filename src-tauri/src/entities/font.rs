use serde::Serialize;

#[derive(Serialize)]
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
