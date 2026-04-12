use crate::{entities::Settings, repository::webdav::dir_repository::prepare_cloud_dirs};

pub async fn ensure_cloud_dirs(settings: &Settings) -> Result<(), String> {
    prepare_cloud_dirs(settings).await
}
