use std::{collections::HashMap, path::PathBuf};

use crate::{
    entities::Settings,
    repository::local_fs::{
        dir_repository::get_local_system_dir,
        file_repository::{read_text_file, write_text_file},
    },
    utils::{
        json::{from_json_str, merge_string_maps, to_pretty_json_string},
        logging::log_error,
    },
};

pub fn get_settings_path() -> Result<PathBuf, String> {
    Ok(get_local_system_dir()?.join("setting.json"))
}

pub fn save_settings(json_str: &str) -> Result<(), String> {
    let settings_path = get_settings_path()?;

    let current_settings: HashMap<String, String> = if settings_path.exists() {
        from_json_str(&read_text_file(&settings_path)?)?
    } else {
        HashMap::new()
    };

    let next_settings: HashMap<String, String> = from_json_str(json_str)?;
    let merged = merge_string_maps(current_settings, next_settings);
    write_text_file(&settings_path, &to_pretty_json_string(&merged)?)
}

pub fn load_settings() -> Result<Settings, String> {
    let settings_path = get_settings_path()?;

    if !settings_path.exists() {
        log_error("file", "load-settings failed file missing");
        return Err("Settings file not found".to_string());
    }

    from_json_str(&read_text_file(&settings_path)?)
}
