use sqlx::SqlitePool;

use crate::{entities::Settings, repository::settings::load_app_settings};

pub async fn load_settings_entity(pool: &SqlitePool) -> Result<Settings, String> {
    load_app_settings(pool).await
}
