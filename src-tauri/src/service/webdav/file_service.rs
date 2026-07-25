use crate::{
    entities::webdav_error::WebDavError,
    repository::webdav::{
        client::build_webdav_client,
        file_repository::{
            delete_remote_file, download_remote_file, remote_file_exists, upload_remote_file,
        },
    },
    service::{
        filesystem::settings_service::load_settings_entity, webdav::dir_service::ensure_cloud_dirs,
    },
    utils::logging::{finish_timer, log_warn, start_timer},
};
use sqlx::SqlitePool;

async fn retry_once<T, F, Fut>(label: &str, operation: F) -> Result<T, WebDavError>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T, WebDavError>>,
{
    match operation().await {
        Ok(value) => Ok(value),
        Err(first_error) => {
            log_warn(
                "webdav",
                &format!("{} failed, retrying once: {}", label, first_error.message),
            );
            operation().await
        }
    }
}

pub async fn webdav_upload_file(
    pool: &SqlitePool,
    subdir: &str,
    filename: &str,
    contents: Vec<u8>,
) -> Result<(), WebDavError> {
    let started_at = start_timer("webdav", "webdav-upload");
    let settings = load_settings_entity(pool).await.map_err(|error| WebDavError {
        status_code: 0,
        operation: "upload".to_string(),
        resource: format!("{}/{}", subdir, filename),
        message: error,
    })?;
    ensure_cloud_dirs(&settings).await.map_err(|error| WebDavError {
        status_code: 0,
        operation: "upload".to_string(),
        resource: format!("{}/{}", subdir, filename),
        message: error,
    })?;
    let client = build_webdav_client();
    let result = retry_once("webdav-upload", || async {
        upload_remote_file(&client, &settings, subdir, filename, contents.clone()).await
    })
    .await;
    if result.is_ok() {
        finish_timer("webdav", "webdav-upload", started_at);
    }
    result
}

pub async fn webdav_get_file(
    pool: &SqlitePool,
    subdir: &str,
    filename: &str,
) -> Result<Vec<u8>, WebDavError> {
    let started_at = start_timer("webdav", "webdav-get");
    let settings = load_settings_entity(pool).await.map_err(|error| WebDavError {
        status_code: 0,
        operation: "download".to_string(),
        resource: format!("{}/{}", subdir, filename),
        message: error,
    })?;
    let client = build_webdav_client();
    let result = retry_once("webdav-get", || async {
        download_remote_file(&client, &settings, subdir, filename).await
    })
    .await;
    if result.is_ok() {
        finish_timer("webdav", "webdav-get", started_at);
    }
    result
}

pub async fn webdav_file_exists(
    pool: &SqlitePool,
    subdir: &str,
    filename: &str,
) -> Result<bool, WebDavError> {
    let settings = load_settings_entity(pool).await.map_err(|error| WebDavError {
        status_code: 0,
        operation: "exists".to_string(),
        resource: format!("{}/{}", subdir, filename),
        message: error,
    })?;
    let client = build_webdav_client();
    remote_file_exists(&client, &settings, subdir, filename).await
}

pub async fn webdav_delete_file(
    pool: &SqlitePool,
    subdir: &str,
    filename: &str,
) -> Result<(), WebDavError> {
    let settings = load_settings_entity(pool).await.map_err(|error| WebDavError {
        status_code: 0,
        operation: "delete".to_string(),
        resource: format!("{}/{}", subdir, filename),
        message: error,
    })?;
    let client = build_webdav_client();
    delete_remote_file(&client, &settings, subdir, filename).await
}
