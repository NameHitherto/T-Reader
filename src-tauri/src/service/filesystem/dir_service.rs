use crate::{
    entities::{CloudDirNames, LocalDirNames},
    repository::local_fs::dir_repository::{ensure_local_dirs, get_cloud_dir_names, get_local_dir_names},
};

#[cfg(not(debug_assertions))]
use crate::repository::local_fs::dir_repository::get_local_logs_dir;

pub fn check_local_dirs() -> Result<String, String> {
    Ok(ensure_local_dirs()?.to_string_lossy().to_string())
}

#[cfg(not(debug_assertions))]
pub fn get_local_logs_dir_path() -> Result<std::path::PathBuf, String> {
    get_local_logs_dir()
}

pub fn local_dir_names() -> LocalDirNames {
    get_local_dir_names()
}

pub fn cloud_dir_names() -> CloudDirNames {
    get_cloud_dir_names()
}
