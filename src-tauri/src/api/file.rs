use crate::service::filesystem::file_service::copy_file_to_subdir as service_copy_file_to_subdir;

#[tauri::command]
pub fn copy_file_to_subdir(filepath: &str, subdir: &str, filename: &str) -> Result<(), String> {
    service_copy_file_to_subdir(filepath, subdir, filename)
}
