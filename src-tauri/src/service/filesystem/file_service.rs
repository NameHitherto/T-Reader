use std::path::PathBuf;

use crate::{
    repository::local_fs::{
        dir_repository::ensure_local_dirs,
        file_repository::{copy_file, log_file_copy},
    }
};

pub fn copy_file_to_subdir(filepath: &str, subdir: &str, filename: &str) -> Result<(), String> {
    let dir_path = ensure_local_dirs()?.join(subdir);
    let target_path = dir_path.join(filename);
    let source_path = PathBuf::from(filepath);
    let copied_bytes = copy_file(&source_path, &target_path)?;
    log_file_copy("file", &source_path, &target_path, copied_bytes);
    Ok(())
}
