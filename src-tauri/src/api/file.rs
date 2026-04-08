use crate::{
    entities::{Settings, StoredBook},
    service::filesystem::{
        book_progress_service::load_book_progresses,
        file_service::{
            delete_file_from_subdir, list_files_in_subdir, read_binary_file_from_subdir,
            read_file_from_path, save_text_file_to_subdir, write_binary_file_to_subdir,
        },
        settings_service::{load_settings_entity, save_settings_json},
    },
};

#[tauri::command]
pub fn save_settings(json_str: &str) -> Result<(), String> {
    save_settings_json(json_str)
}

#[tauri::command]
pub fn load_settings() -> Result<Settings, String> {
    load_settings_entity()
}

#[tauri::command]
pub fn save_file(subdir: &str, filename: &str, contents: &str) -> Result<(), String> {
    save_text_file_to_subdir(subdir, filename, contents)
}

#[tauri::command]
pub fn load_books(subdir: &str) -> Result<Vec<StoredBook>, String> {
    load_book_progresses(subdir)
}

#[tauri::command]
pub fn delete_book(subdir: &str, filename: &str) -> Result<(), String> {
    delete_file_from_subdir(subdir, filename)
}

#[tauri::command]
pub fn read_file(subdir: &str, filename: &str) -> Result<Vec<u8>, String> {
    read_binary_file_from_subdir(subdir, filename)
}

#[tauri::command]
pub fn write_file(subdir: &str, filename: &str, contents: Vec<u8>) -> Result<(), String> {
    write_binary_file_to_subdir(subdir, filename, &contents)
}

#[tauri::command]
pub fn read_file_by_path(filepath: &str) -> Result<Vec<u8>, String> {
    read_file_from_path(filepath)
}

#[tauri::command]
pub fn list_files(subdir: &str) -> Result<Vec<String>, String> {
    list_files_in_subdir(subdir)
}
