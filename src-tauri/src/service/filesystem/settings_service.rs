use crate::{
    entities::Settings,
    repository::local_fs::settings_repository::{load_settings, save_settings},
};

pub fn save_settings_json(json_str: &str) -> Result<(), String> {
    save_settings(json_str)
}

pub fn load_settings_entity() -> Result<Settings, String> {
    load_settings()
}
