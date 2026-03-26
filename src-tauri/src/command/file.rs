use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};

use crate::command::dir::{check_local_dirs, get_local_root_dir, get_local_system_dir};
use crate::logging::{finish_timer, log_error, log_info, start_timer};
use crate::model::{Book, Settings};

#[tauri::command]
pub fn save_settings(json_str: &str) -> Result<(), String> {
    let started_at = start_timer("file", "save-settings");
    let system_path = get_local_system_dir()?;

    if !system_path.exists() {
        fs::create_dir_all(&system_path).map_err(|e| e.to_string())?;
    }

    let settings_path = system_path.join("setting.json");

    let mut settings: HashMap<String, String> = if settings_path.exists() {
        let mut file = File::open(&settings_path).map_err(|e| e.to_string())?;
        let mut contents = String::new();
        file.read_to_string(&mut contents)
            .map_err(|e| e.to_string())?;
        serde_json::from_str(&contents).map_err(|e| e.to_string())?
    } else {
        HashMap::new()
    };

    let new_settings: HashMap<String, String> =
        serde_json::from_str(json_str).map_err(|e| e.to_string())?;
    for (key, value) in new_settings {
        settings.insert(key, value);
    }

    let settings_json = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    let mut file = File::create(&settings_path).map_err(|e| e.to_string())?;
    file.write_all(settings_json.as_bytes())
        .map_err(|e| e.to_string())?;

    finish_timer("file", "save-settings", started_at);
    Ok(())
}

#[tauri::command]
pub fn load_settings() -> Result<Settings, String> {
    let system_path = get_local_system_dir()?;

    if !system_path.exists() {
        fs::create_dir_all(&system_path).map_err(|e| e.to_string())?;
    }

    let settings_path = system_path.join("setting.json");

    if !settings_path.exists() {
        log_error("file", "load-settings failed file missing");
        return Err("Settings file not found".to_string());
    }

    let mut file = File::open(&settings_path).map_err(|e| e.to_string())?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| e.to_string())?;
    let settings: Settings = serde_json::from_str(&contents).map_err(|e| e.to_string())?;

    Ok(settings)
}

#[tauri::command]
pub fn save_file(subdir: &str, filename: &str, contents: &str) -> Result<(), String> {
    let started_at = start_timer("file", "save-file");
    let root_path = check_local_dirs()?;
    let dir_path = root_path.join(subdir);

    if !dir_path.exists() {
        fs::create_dir_all(&dir_path).map_err(|e| e.to_string())?;
    }

    let file_path = dir_path.join(filename);
    let mut file = File::create(&file_path).map_err(|e| e.to_string())?;
    file.write_all(contents.as_bytes())
        .map_err(|e| e.to_string())?;

    log_info(
        "file",
        &format!(
            "save-file path={} bytes={}",
            file_path.display(),
            contents.as_bytes().len()
        ),
    );
    finish_timer("file", "save-file", started_at);
    Ok(())
}

#[tauri::command]
pub fn load_books(subdir: &str) -> Result<Vec<Book>, String> {
    let started_at = start_timer("file", "load-books");
    let root_path = check_local_dirs()?;
    let dir_path = root_path.join(subdir);

    if !dir_path.exists() {
        fs::create_dir_all(&dir_path).map_err(|e| e.to_string())?;
    }

    let mut books = Vec::new();
    for entry in fs::read_dir(&dir_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        if entry_path.extension().and_then(|s| s.to_str()) == Some("json") {
            let mut file = File::open(&entry_path).map_err(|e| e.to_string())?;
            let mut contents = String::new();
            file.read_to_string(&mut contents)
                .map_err(|e| e.to_string())?;
            match serde_json::from_str::<Book>(&contents) {
                Ok(book) => books.push(book),
                Err(_) => continue,
            }
        }
    }

    log_info(
        "file",
        &format!("load-books subdir={} total={}", subdir, books.len()),
    );
    finish_timer("file", "load-books", started_at);
    Ok(books)
}

#[tauri::command]
pub fn delete_book(subdir: &str, filename: &str) -> Result<(), String> {
    check_local_dirs()?;

    let root_path = get_local_root_dir()?;
    let dir_path = root_path.join(subdir);
    let file_path = dir_path.join(filename);

    if file_path.exists() {
        fs::remove_file(&file_path).map_err(|e| e.to_string())?;
        log_info("file", &format!("delete-book path={}", file_path.display()));
    }

    Ok(())
}

#[tauri::command]
pub fn read_file(subdir: &str, filename: &str) -> Result<Vec<u8>, String> {
    let started_at = start_timer("file", "read-file");
    let root_path = check_local_dirs()?;
    let dir_path = root_path.join(subdir);
    let file_path = dir_path.join(filename);

    let mut file = File::open(&file_path).map_err(|e| e.to_string())?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents).map_err(|e| e.to_string())?;

    log_info(
        "file",
        &format!(
            "read-file path={} bytes={}",
            file_path.display(),
            contents.len()
        ),
    );
    finish_timer("file", "read-file", started_at);
    Ok(contents)
}

#[tauri::command]
pub fn write_file(subdir: &str, filename: &str, contents: Vec<u8>) -> Result<(), String> {
    let started_at = start_timer("file", "write-file");
    let root_path = check_local_dirs()?;
    let dir_path = root_path.join(subdir);

    if !dir_path.exists() {
        fs::create_dir_all(&dir_path).map_err(|e| e.to_string())?;
    }

    let file_path = dir_path.join(filename);
    let mut file = File::create(&file_path).map_err(|e| e.to_string())?;
    file.write_all(&contents).map_err(|e| e.to_string())?;

    log_info(
        "file",
        &format!(
            "write-file path={} bytes={}",
            file_path.display(),
            contents.len()
        ),
    );
    finish_timer("file", "write-file", started_at);
    Ok(())
}

#[tauri::command]
pub fn read_file_by_path(filepath: &str) -> Result<Vec<u8>, String> {
    let started_at = start_timer("file", "read-file-by-path");
    let mut file = File::open(filepath).map_err(|e| e.to_string())?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents).map_err(|e| e.to_string())?;

    log_info(
        "file",
        &format!(
            "read-file-by-path path={} bytes={}",
            filepath,
            contents.len()
        ),
    );
    finish_timer("file", "read-file-by-path", started_at);
    Ok(contents)
}

#[tauri::command]
pub fn list_files(subdir: &str) -> Result<Vec<String>, String> {
    let root_path = check_local_dirs()?;
    let dir_path = root_path.join(subdir);

    if !dir_path.exists() {
        fs::create_dir_all(&dir_path).map_err(|e| e.to_string())?;
    }

    let mut filenames = Vec::new();
    for entry in fs::read_dir(&dir_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        if let Some(file_name) = entry_path.file_name().and_then(|value| value.to_str()) {
            filenames.push(file_name.to_string());
        }
    }

    log_info(
        "file",
        &format!("list-files subdir={} total={}", subdir, filenames.len()),
    );
    Ok(filenames)
}
