use reqwest::Client;

use crate::{
    entities::Settings,
    utils::{
        logging::log_info,
        webdav::{get_remote_file_url, parse_webdav_response},
    },
};

pub async fn list_remote_files(
    client: &Client,
    settings: &Settings,
    subdir: &str,
) -> Result<Vec<String>, String> {
    let url = format!("{}/{}/", settings.webdav_url.trim_end_matches('/'), subdir);
    let response = client
        .request(http::Method::from_bytes(b"PROPFIND").unwrap(), &url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .header("Depth", "1")
        .send()
        .await
        .map_err(|error| format!("failed to list remote files: {:?}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "failed to list remote files: {:?}",
            response.status()
        ));
    }

    let body = response.text().await.map_err(|error| error.to_string())?;
    let files = parse_webdav_response(&body)?;
    log_info(
        "webdav",
        &format!("list-remote-files subdir={} total={}", subdir, files.len()),
    );
    Ok(files)
}

pub async fn download_remote_file(
    client: &Client,
    settings: &Settings,
    subdir: &str,
    filename: &str,
) -> Result<Vec<u8>, String> {
    let url = get_remote_file_url(&settings.webdav_url, subdir, filename);
    let response = client
        .get(&url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .send()
        .await
        .map_err(|error| format!("failed to download remote file: {:?}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "failed to download remote file: {:?}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|error| error.to_string())?
        .to_vec();
    log_info(
        "webdav",
        &format!(
            "download-remote-file subdir={} filename={} bytes={}",
            subdir,
            filename,
            bytes.len()
        ),
    );
    Ok(bytes)
}

pub async fn upload_remote_file(
    client: &Client,
    settings: &Settings,
    subdir: &str,
    filename: &str,
    contents: Vec<u8>,
) -> Result<(), String> {
    let content_len = contents.len();
    let url = get_remote_file_url(&settings.webdav_url, subdir, filename);
    let response = client
        .put(&url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .body(contents)
        .send()
        .await
        .map_err(|error| format!("failed to upload remote file: {:?}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "failed to upload remote file: {:?}",
            response.status()
        ));
    }

    log_info(
        "webdav",
        &format!(
            "upload-remote-file subdir={} filename={} bytes={}",
            subdir, filename, content_len
        ),
    );
    Ok(())
}

pub async fn remote_file_exists(
    client: &Client,
    settings: &Settings,
    subdir: &str,
    filename: &str,
) -> Result<bool, String> {
    let url = get_remote_file_url(&settings.webdav_url, subdir, filename);
    let response = client
        .request(http::Method::from_bytes(b"PROPFIND").unwrap(), &url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .header("Depth", "0")
        .send()
        .await
        .map_err(|error| format!("failed to check remote file exists: {:?}", error))?;

    if response.status().is_success() {
        return Ok(true);
    }

    if response.status().as_u16() == 404 {
        return Ok(false);
    }

    Err(format!(
        "failed to check remote file exists: {:?}",
        response.status()
    ))
}

pub async fn delete_remote_file(
    client: &Client,
    settings: &Settings,
    subdir: &str,
    filename: &str,
) -> Result<(), String> {
    let url = get_remote_file_url(&settings.webdav_url, subdir, filename);
    let response = client
        .delete(&url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .send()
        .await
        .map_err(|error| format!("failed to delete remote file: {:?}", error))?;

    if !response.status().is_success() {
        return Err(format!(
            "failed to delete remote file: {:?}",
            response.status()
        ));
    }

    log_info(
        "webdav",
        &format!("webdav-delete subdir={} filename={}", subdir, filename),
    );
    Ok(())
}
