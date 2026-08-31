use reqwest::Client;

use crate::{
    entities::{webdav_error::WebDavError, Settings},
    utils::{
        logging::log_info,
        webdav::{get_remote_file_url, parse_webdav_response, parse_webdav_response_meta, RemoteFileMeta},
    },
};

fn build_resource(subdir: &str, filename: &str) -> String {
    format!("{}/{}", subdir, filename)
}

pub async fn list_remote_files_with_meta(
    client: &Client,
    settings: &Settings,
    subdir: &str,
) -> Result<Vec<RemoteFileMeta>, WebDavError> {
    let url = format!("{}/{}/", settings.webdav_url.trim_end_matches('/'), subdir);
    let response = client
        .request(http::Method::from_bytes(b"PROPFIND").unwrap(), &url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .header("Depth", "1")
        .send()
        .await
        .map_err(|error| WebDavError {
            status_code: 0,
            operation: "list".to_string(),
            resource: subdir.to_string(),
            message: format!("网络请求失败: {:?}", error),
        })?;

    let status = response.status().as_u16();
    if !response.status().is_success() {
        return Err(WebDavError {
            status_code: status,
            operation: "list".to_string(),
            resource: subdir.to_string(),
            message: format!("列出远程文件失败，HTTP 状态码: {}", status),
        });
    }

    let body = response.text().await.map_err(|error| WebDavError {
        status_code: 0,
        operation: "list".to_string(),
        resource: subdir.to_string(),
        message: format!("读取响应体失败: {}", error),
    })?;
    let metas = parse_webdav_response_meta(&body).map_err(|error| WebDavError {
        status_code: 0,
        operation: "list".to_string(),
        resource: subdir.to_string(),
        message: error,
    })?;
    log_info(
        "webdav",
        &format!(
            "list-remote-files subdir={} total={}",
            subdir,
            metas.len()
        ),
    );
    Ok(metas)
}

pub async fn list_remote_files(
    client: &Client,
    settings: &Settings,
    subdir: &str,
) -> Result<Vec<String>, WebDavError> {
    let url = format!("{}/{}/", settings.webdav_url.trim_end_matches('/'), subdir);
    let response = client
        .request(http::Method::from_bytes(b"PROPFIND").unwrap(), &url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .header("Depth", "1")
        .send()
        .await
        .map_err(|error| WebDavError {
            status_code: 0,
            operation: "list".to_string(),
            resource: subdir.to_string(),
            message: format!("网络请求失败: {:?}", error),
        })?;

    let status = response.status().as_u16();
    if !response.status().is_success() {
        return Err(WebDavError {
            status_code: status,
            operation: "list".to_string(),
            resource: subdir.to_string(),
            message: format!("列出远程文件失败，HTTP 状态码: {}", status),
        });
    }

    let body = response.text().await.map_err(|error| WebDavError {
        status_code: 0,
        operation: "list".to_string(),
        resource: subdir.to_string(),
        message: format!("读取响应体失败: {}", error),
    })?;
    let files = parse_webdav_response(&body).map_err(|error| WebDavError {
        status_code: 0,
        operation: "list".to_string(),
        resource: subdir.to_string(),
        message: error,
    })?;
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
) -> Result<Vec<u8>, WebDavError> {
    let url = get_remote_file_url(&settings.webdav_url, subdir, filename);
    let response = client
        .get(&url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .send()
        .await
        .map_err(|error| WebDavError {
            status_code: 0,
            operation: "download".to_string(),
            resource: build_resource(subdir, filename),
            message: format!("网络请求失败: {:?}", error),
        })?;

    let status = response.status().as_u16();
    if !response.status().is_success() {
        return Err(WebDavError {
            status_code: status,
            operation: "download".to_string(),
            resource: build_resource(subdir, filename),
            message: format!("下载远程文件失败，HTTP 状态码: {}", status),
        });
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|error| WebDavError {
            status_code: 0,
            operation: "download".to_string(),
            resource: build_resource(subdir, filename),
            message: format!("读取响应体失败: {}", error),
        })?
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
) -> Result<(), WebDavError> {
    let content_len = contents.len();
    let url = get_remote_file_url(&settings.webdav_url, subdir, filename);
    let response = client
        .put(&url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .body(contents)
        .send()
        .await
        .map_err(|error| WebDavError {
            status_code: 0,
            operation: "upload".to_string(),
            resource: build_resource(subdir, filename),
            message: format!("网络请求失败: {:?}", error),
        })?;

    let status = response.status().as_u16();
    if !response.status().is_success() {
        return Err(WebDavError {
            status_code: status,
            operation: "upload".to_string(),
            resource: build_resource(subdir, filename),
            message: format!("上传远程文件失败，HTTP 状态码: {}", status),
        });
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
) -> Result<bool, WebDavError> {
    let url = get_remote_file_url(&settings.webdav_url, subdir, filename);
    let response = client
        .request(http::Method::from_bytes(b"PROPFIND").unwrap(), &url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .header("Depth", "0")
        .send()
        .await
        .map_err(|error| WebDavError {
            status_code: 0,
            operation: "exists".to_string(),
            resource: build_resource(subdir, filename),
            message: format!("网络请求失败: {:?}", error),
        })?;

    if response.status().is_success() {
        return Ok(true);
    }

    let status = response.status().as_u16();
    if status == 404 {
        return Ok(false);
    }

    Err(WebDavError {
        status_code: status,
        operation: "exists".to_string(),
        resource: build_resource(subdir, filename),
        message: format!("检查远程文件存在性失败，HTTP 状态码: {}", status),
    })
}

pub async fn delete_remote_file(
    client: &Client,
    settings: &Settings,
    subdir: &str,
    filename: &str,
) -> Result<(), WebDavError> {
    let url = get_remote_file_url(&settings.webdav_url, subdir, filename);
    let response = client
        .delete(&url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .send()
        .await
        .map_err(|error| WebDavError {
            status_code: 0,
            operation: "delete".to_string(),
            resource: build_resource(subdir, filename),
            message: format!("网络请求失败: {:?}", error),
        })?;

    let status = response.status().as_u16();
    if !response.status().is_success() {
        return Err(WebDavError {
            status_code: status,
            operation: "delete".to_string(),
            resource: build_resource(subdir, filename),
            message: format!("删除远程文件失败，HTTP 状态码: {}", status),
        });
    }

    log_info(
        "webdav",
        &format!("webdav-delete subdir={} filename={}", subdir, filename),
    );
    Ok(())
}
