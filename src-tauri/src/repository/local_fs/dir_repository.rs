use dirs::document_dir;
use std::{fs, path::PathBuf};

use crate::{
    entities::Settings,
    repository::webdav::client::build_webdav_client,
    utils::logging::{log_error, log_info, log_warn},
};

pub const LOCAL_BOOKS_DIR: &str = "books";
pub const LOCAL_PROGRESS_DIR: &str = "bookProgress";
pub const LOCAL_CACHED_DIR: &str = "cached";
pub const LOCAL_LOGS_DIR: &str = "logs";
pub const LOCAL_SYSTEM_DIR: &str = "system";

pub const CLOUD_BOOKS_DIR: &str = "books";
pub const CLOUD_PROGRESS_DIR: &str = "bookProgress";

const LOCAL_SUBDIRS: [&str; 4] = [
    LOCAL_BOOKS_DIR,
    LOCAL_PROGRESS_DIR,
    LOCAL_CACHED_DIR,
    LOCAL_SYSTEM_DIR,
];
const CLOUD_SUBDIRS: [&str; 2] = [CLOUD_BOOKS_DIR, CLOUD_PROGRESS_DIR];

pub fn get_local_root_dir() -> Result<PathBuf, String> {
    let mut path = document_dir().ok_or("err finding document_dir")?;
    path.push("T-Reader");
    Ok(path)
}

pub fn get_local_system_dir() -> Result<PathBuf, String> {
    Ok(get_local_root_dir()?.join(LOCAL_SYSTEM_DIR))
}

#[cfg(not(debug_assertions))]
pub fn get_local_cached_dir() -> Result<PathBuf, String> {
    Ok(get_local_root_dir()?.join(LOCAL_CACHED_DIR))
}

#[cfg(not(debug_assertions))]
pub fn get_local_logs_dir() -> Result<PathBuf, String> {
    Ok(get_local_cached_dir()?.join(LOCAL_LOGS_DIR))
}

pub fn ensure_local_dirs() -> Result<PathBuf, String> {
    let root_path = get_local_root_dir()?;

    if !root_path.exists() {
        log_info(
            "filesystem",
            &format!("creating-local-root path={}", root_path.display()),
        );
        fs::create_dir_all(&root_path).map_err(|error| {
            log_error(
                "filesystem",
                &format!(
                    "create-local-root failed path={} error={}",
                    root_path.display(),
                    error
                ),
            );
            error.to_string()
        })?;
    }

    for subdir in LOCAL_SUBDIRS {
        let subdir_path = root_path.join(subdir);
        if !subdir_path.exists() {
            log_info(
                "filesystem",
                &format!("creating-local-subdir path={}", subdir_path.display()),
            );
            fs::create_dir_all(&subdir_path).map_err(|error| {
                log_error(
                    "filesystem",
                    &format!(
                        "create-local-subdir failed path={} error={}",
                        subdir_path.display(),
                        error
                    ),
                );
                error.to_string()
            })?;
        }
    }

    let logs_dir_path = root_path.join(LOCAL_CACHED_DIR).join(LOCAL_LOGS_DIR);
    if !logs_dir_path.exists() {
        log_info(
            "filesystem",
            &format!("creating-local-subdir path={}", logs_dir_path.display()),
        );
        fs::create_dir_all(&logs_dir_path).map_err(|error| {
            log_error(
                "filesystem",
                &format!(
                    "create-local-subdir failed path={} error={}",
                    logs_dir_path.display(),
                    error
                ),
            );
            error.to_string()
        })?;
    }

    Ok(root_path)
}

pub async fn ensure_cloud_dirs(settings: &Settings) -> Result<(), String> {
    let client = build_webdav_client(settings.webdav_timeout_seconds, settings.proxy_enabled);

    let root_url = settings.webdav_url.trim_end_matches('/').to_string() + "/";
    let _ = client
        .request(http::Method::from_bytes(b"MKCOL").unwrap(), &root_url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .send()
        .await;

    for subdir in CLOUD_SUBDIRS {
        let dir_url = format!("{}{}/", settings.webdav_url, subdir);
        let response = client
            .request(http::Method::from_bytes(b"MKCOL").unwrap(), &dir_url)
            .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
            .send()
            .await;

        match response {
            Ok(resp) => {
                let status = resp.status();
                let status_code = status.as_u16();
                if status.is_success() {
                    log_info(
                        "webdav",
                        &format!("cloud-dir-ready subdir={} status={}", subdir, status_code),
                    );
                } else if matches!(status_code, 301 | 302 | 405 | 409) {
                    // 405: RFC 4918 规定对已存在的集合执行 MKCOL 应返回 405;
                    // 409: 部分服务器（如坚果云）对已存在目录返回 409;
                    // 301/302: 已存在路径可能被服务器重定向。
                    // 以上均视为目录已存在，属于期望状态。
                    log_info(
                        "webdav",
                        &format!("cloud-dir-exists subdir={} status={}", subdir, status_code),
                    );
                } else {
                    log_warn(
                        "webdav",
                        &format!("cloud-dir-check status={} subdir={}", status_code, subdir),
                    );
                }
            }
            Err(error) => {
                log_warn(
                    "webdav",
                    &format!("cloud-dir-check failed subdir={} error={}", subdir, error),
                );
            }
        }
    }

    Ok(())
}
