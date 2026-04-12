use crate::{entities::Settings, repository::local_fs::settings_repository::load_settings};

pub fn load_settings_entity() -> Result<Settings, String> {
    load_settings()
}
