use serde::Serialize;

#[derive(Serialize)]
pub struct FontNameEntry {
    pub family: String,
    pub postscript_name: Option<String>,
    pub style: Option<String>,
    pub weight: Option<u16>,
    pub path: Option<String>,
}
