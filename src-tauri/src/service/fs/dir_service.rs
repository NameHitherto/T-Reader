#[cfg(not(debug_assertions))]
use crate::repository::local_fs::dir_repository::get_local_logs_dir;

#[cfg(not(debug_assertions))]
pub fn get_local_logs_dir_path() -> Result<std::path::PathBuf, String> {
    get_local_logs_dir()
}
