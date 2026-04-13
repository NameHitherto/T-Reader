use std::path::PathBuf;

use crate::{
    entities::Settings,
    repository::local_fs::{dir_repository::get_local_system_dir, file_repository::read_text_file},
    utils::{json::from_json_str, logging::log_error},
};

pub fn get_settings_path() -> Result<PathBuf, String> {
    Ok(get_local_system_dir()?.join("setting.json"))
}

pub fn load_settings() -> Result<Settings, String> {
    let settings_path = get_settings_path()?;

    if !settings_path.exists() {
        log_error("file", "load-settings failed file missing");
        return Err("Settings file not found".to_string());
    }

    from_json_str(&read_text_file(&settings_path)?)
}
