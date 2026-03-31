use dirs::document_dir;
use serde::Serialize;
use std::fs;

use crate::logging::{log_error, log_info, log_warn};

const LOCAL_BOOKS_DIR: &str = "books";
const LOCAL_PROGRESS_DIR: &str = "bookProgress";
const LOCAL_CACHED_DIR: &str = "cached";
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

#[derive(Serialize, Clone)]
pub struct LocalDirNames {
    pub books: String,
    pub progress: String,
    pub cached: String,
    pub system: String,
}

#[derive(Serialize, Clone)]
pub struct CloudDirNames {
    pub books: String,
    pub progress: String,
}

pub fn get_local_dir_names() -> LocalDirNames {
    LocalDirNames {
        books: LOCAL_BOOKS_DIR.to_string(),
        progress: LOCAL_PROGRESS_DIR.to_string(),
        cached: LOCAL_CACHED_DIR.to_string(),
        system: LOCAL_SYSTEM_DIR.to_string(),
    }
}

pub fn get_cloud_dir_names() -> CloudDirNames {
    CloudDirNames {
        books: CLOUD_BOOKS_DIR.to_string(),
        progress: CLOUD_PROGRESS_DIR.to_string(),
    }
}

pub fn get_local_root_dir() -> Result<std::path::PathBuf, String> {
    let mut path = document_dir().ok_or("err finding document_dir")?;
    path.push("T-Reader");
    Ok(path)
}

pub fn get_local_system_dir() -> Result<std::path::PathBuf, String> {
    let root = get_local_root_dir()?;
    Ok(root.join(LOCAL_SYSTEM_DIR))
}

#[cfg(not(debug_assertions))]
pub fn get_local_cached_dir() -> Result<std::path::PathBuf, String> {
    let root = get_local_root_dir()?;
    Ok(root.join(LOCAL_CACHED_DIR))
}

pub fn check_local_dirs() -> Result<std::path::PathBuf, String> {
    let root_path = get_local_root_dir()?;

    if !root_path.exists() {
        log_info(
            "dir",
            &format!("creating-local-root path={}", root_path.display()),
        );
        fs::create_dir_all(&root_path).map_err(|error| {
            log_error(
                "dir",
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
                "dir",
                &format!("creating-local-subdir path={}", subdir_path.display()),
            );
            fs::create_dir_all(&subdir_path).map_err(|error| {
                log_error(
                    "dir",
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

    Ok(root_path)
}

pub async fn check_cloud_dirs(settings: &crate::model::Settings) -> Result<(), String> {
    let client = reqwest::Client::new();

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
                if status.is_success() {
                    log_info(
                        "dir",
                        &format!("cloud-dir-ready subdir={} status={}", subdir, status),
                    );
                } else if status.as_u16() == 409 {
                    log_info("dir", &format!("cloud-dir-exists subdir={}", subdir));
                } else {
                    log_warn(
                        "dir",
                        &format!("cloud-dir-check status={} subdir={}", status, subdir),
                    );
                }
            }
            Err(error) => {
                log_warn(
                    "dir",
                    &format!("cloud-dir-check failed subdir={} error={}", subdir, error),
                );
            }
        }
    }

    let root_url = settings.webdav_url.trim_end_matches('/').to_string() + "/";
    let _ = client
        .request(http::Method::from_bytes(b"MKCOL").unwrap(), &root_url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .send()
        .await;

    Ok(())
}

#[tauri::command]
pub fn check_local_dirs_command() -> Result<String, String> {
    let root_path = check_local_dirs()?;
    Ok(root_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn check_cloud_dirs_command() -> Result<(), String> {
    let settings = crate::command::load_settings()?;
    check_cloud_dirs(&settings).await
}

#[tauri::command]
pub fn get_local_dir_names_command() -> LocalDirNames {
    get_local_dir_names()
}

#[tauri::command]
pub fn get_cloud_dir_names_command() -> CloudDirNames {
    get_cloud_dir_names()
}
