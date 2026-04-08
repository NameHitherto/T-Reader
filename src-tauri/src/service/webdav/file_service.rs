use crate::{
    repository::webdav::{
        client::build_webdav_client,
        file_repository::{
            delete_remote_file, download_remote_file, remote_file_exists, upload_remote_file,
        },
    },
    service::{filesystem::settings_service::load_settings_entity, webdav::dir_service::ensure_cloud_dirs},
    utils::logging::{finish_timer, start_timer},
};

pub async fn webdav_upload_file(
    subdir: &str,
    filename: &str,
    contents: Vec<u8>,
) -> Result<(), String> {
    let started_at = start_timer("webdav", "webdav-upload");
    let settings = load_settings_entity()?;
    ensure_cloud_dirs(&settings).await?;
    let client = build_webdav_client();
    let result = upload_remote_file(&client, &settings, subdir, filename, contents).await;
    if result.is_ok() {
        finish_timer("webdav", "webdav-upload", started_at);
    }
    result
}

pub async fn webdav_get_file(subdir: &str, filename: &str) -> Result<Vec<u8>, String> {
    let started_at = start_timer("webdav", "webdav-get");
    let settings = load_settings_entity()?;
    let client = build_webdav_client();
    let result = download_remote_file(&client, &settings, subdir, filename).await;
    if result.is_ok() {
        finish_timer("webdav", "webdav-get", started_at);
    }
    result
}

pub async fn webdav_file_exists(subdir: &str, filename: &str) -> Result<bool, String> {
    let settings = load_settings_entity()?;
    let client = build_webdav_client();
    remote_file_exists(&client, &settings, subdir, filename).await
}

pub async fn webdav_delete_file(subdir: &str, filename: &str) -> Result<(), String> {
    let settings = load_settings_entity()?;
    let client = build_webdav_client();
    delete_remote_file(&client, &settings, subdir, filename).await
}
