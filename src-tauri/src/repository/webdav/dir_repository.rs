use crate::{entities::Settings, repository::local_fs::dir_repository::ensure_cloud_dirs};

pub async fn prepare_cloud_dirs(settings: &Settings) -> Result<(), String> {
    ensure_cloud_dirs(settings).await
}
