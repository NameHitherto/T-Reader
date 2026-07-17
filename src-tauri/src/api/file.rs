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

#[tauri::command]
pub fn read_local_cover_file(filepath: String) -> Result<Vec<u8>, String> {
    const MAX_COVER_BYTES: u64 = 5 * 1024 * 1024;

    let path = std::path::Path::new(&filepath);
    let metadata = std::fs::metadata(path).map_err(|error| format!("读取封面文件失败: {}", error))?;
    if metadata.len() > MAX_COVER_BYTES {
        return Err("封面大小不能超过 5MB".to_string());
    }

    let bytes = std::fs::read(path).map_err(|error| format!("读取封面文件失败: {}", error))?;
    let is_jpeg = bytes.starts_with(&[0xFF, 0xD8, 0xFF]);
    let is_png = bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]);
    if !is_jpeg && !is_png {
        return Err("仅支持 JPG/JPEG 或 PNG 封面".to_string());
    }

    Ok(bytes)
}
