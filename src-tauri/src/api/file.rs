use crate::service::filesystem::file_service::{
    convert_txt_to_epub as service_convert_txt_to_epub,
    copy_file_to_subdir as service_copy_file_to_subdir,
};

#[tauri::command]
pub fn copy_file_to_subdir(filepath: &str, subdir: &str, filename: &str) -> Result<(), String> {
    service_copy_file_to_subdir(filepath, subdir, filename)
}

#[tauri::command]
pub fn convert_txt_to_epub(filepath: &str, subdir: &str, filename: &str) -> Result<String, String> {
    service_convert_txt_to_epub(filepath, subdir, filename)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalCoverFile {
    bytes: Vec<u8>,
    extension: String,
    mime_type: String,
}

#[tauri::command]
pub fn read_local_cover_file(filepath: String) -> Result<LocalCoverFile, String> {
    const MAX_COVER_BYTES: u64 = 5 * 1024 * 1024;

    let path = std::path::Path::new(&filepath);
    let metadata = std::fs::metadata(path).map_err(|error| format!("读取封面文件失败: {}", error))?;
    if metadata.len() > MAX_COVER_BYTES {
        return Err("封面大小不能超过 5MB".to_string());
    }

    let bytes = std::fs::read(path).map_err(|error| format!("读取封面文件失败: {}", error))?;
    let detected = if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some(("jpg", "image/jpeg"))
    } else if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        Some(("png", "image/png"))
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some(("webp", "image/webp"))
    } else {
        None
    };

    let Some((extension, mime_type)) = detected else {
        return Err("仅支持 JPG/JPEG、PNG 或 WebP 封面".to_string());
    };

    Ok(LocalCoverFile {
        bytes,
        extension: extension.to_string(),
        mime_type: mime_type.to_string(),
    })
}
